export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/**
 * Avoids Prisma `upsert` (which requires a transaction in Data Proxy/HTTP mode).
 * We do: find -> (if not exists) try create -> if P2002 then find again.
 */
async function ensureRespondentId(
  prisma: ReturnType<typeof getPrisma>,
  projectId: string,
  externalId: string,
  supplierId: string | null
): Promise<string> {
  const where = { projectId, externalId, supplierId };

  // 1) try find
  const found = await prisma.respondent.findFirst({
    where,
    select: { id: true },
  });
  if (found) return found.id;

  // 2) try create (no transaction)
  try {
    const created = await prisma.respondent.create({
      data: where,
      select: { id: true },
    });
    return created.id;
  } catch (e: any) {
    // 3) if unique violation, someone else created between find/create → fetch again
    // Prisma Accelerate doesn’t always surface error codes, so fall back to find.
    const again = await prisma.respondent.findFirst({
      where,
      select: { id: true },
    });
    if (again) return again.id;
    throw e;
  }
}

async function resolveProjectPreScreen(
  prisma: ReturnType<typeof getPrisma>,
  projectIdOrCode: string
) {
  const proj = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true, preScreen: true },
  });
  if (!proj) {
    const err = new Error("Project not found");
    // Consistent 404 for not found
    (err as any).status = 404;
    throw err;
  }
  return proj; // { id, preScreen }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const url = new URL(req.url);
    const supplierIdRaw = (url.searchParams.get("supplierId") || "").trim();
    const supplierId = supplierIdRaw === "" ? null : supplierIdRaw;

    // Resolve project (by id or code) and read the Prescreen flag
    const { id: realProjectId, preScreen } = await resolveProjectPreScreen(prisma, projectId);

    // If Prescreen checkbox is OFF, treat as no pending — per your rule
    if (!preScreen) {
      return NextResponse.json({ items: [], preScreenEnabled: false });
    }

    // Ensure respondent row exists WITHOUT transactions
    const respondentId = await ensureRespondentId(
      prisma,
      realProjectId,
      identifier,
      supplierId
    );

    // Load answered question ids
    const answered = await prisma.prescreenAnswer.findMany({
      where: { respondentId },
      select: { questionId: true },
    });
    const answeredSet = new Set(answered.map((a) => a.questionId));

    // Load all project questions
    const questions = await prisma.prescreenQuestion.findMany({
      where: { projectId: realProjectId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        question: true,
        controlType: true,
        textMinLength: true,
        textMaxLength: true,
        textType: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, label: true, value: true },
        },
      },
    });

    // Pending = not yet answered
    const pending = questions.filter((q) => !answeredSet.has(q.id));

    return NextResponse.json({ items: pending, preScreenEnabled: true });
  } catch (err: any) {
    const status = Number(err?.status) || 500;

    // IMPORTANT: Never throw the Accelerate “Transactions are not supported in HTTP mode” back to the client;
    // we want the client to be able to decide correctly instead of defaulting to live link.
    // Provide a safe JSON with preScreenEnabled unknown (assume true) and no items on 5xx would still skip.
    // So we explicitly send a 200 but with a diagnostic payload only for that specific error string.
    const msg = String(err?.message || "");
    if (msg.includes("Transactions are not supported in HTTP mode")) {
      // Return a diagnostic payload with NO crash (200 OK), but no items so the UI can retry or route correctly.
      return NextResponse.json(
        {
          items: [],
          preScreenEnabled: true, // conservative: checkbox might be ON; let client fetch again / go Prescreen if it wants to
          hint: "no-tx-mode",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: msg || "Failed to load prescreen" }, { status });
  }
}