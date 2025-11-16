export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const isUniqueViolation = (e: any) =>
  (e && e.code === "P2002") ||
  /unique/i.test(String(e?.message || "")) ||
  /duplicate key value violates unique constraint/i.test(String(e?.message || ""));

const id20 = () => {
  // crypto for stronger randomness in edge/runtime
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);
  (globalThis.crypto ?? require("crypto").webcrypto).getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return s;
};

const replaceTokens = (tpl: string, dict: Record<string, string>) =>
  tpl.replace(/\[([^\]]+)\]/g, (_, k) => dict[k] ?? "");

const isHttp = (u: URL) => u.protocol === "http:" || u.protocol === "https:";

async function resolveProject(
  prisma: ReturnType<typeof getPrisma>,
  key: string
) {
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: key }, { code: key }] },
    select: { id: true, surveyLiveUrl: true }
  });
  if (!p) throw new Error("Project not found");
  if (!p.surveyLiveUrl) throw new Error("Live URL is not configured");
  return p;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const u = new URL(req.url);
  const supplierId = (u.searchParams.get("supplierId") || "").trim();
  const externalOriginal = (u.searchParams.get("id") || "").trim(); // e.g. 389

  try {
    const project = await resolveProject(prisma, projectId);
    const projectDbId = project.id;

    // ---- Idempotency by (project, supplierId, externalId)
    const existing = await prisma.surveyRedirect.findFirst({
      where: {
        projectId: projectDbId,
        supplierId: supplierId || null,
        externalId: externalOriginal || null
      },
      orderBy: { createdAt: "desc" },
      take: 1
    });

    // Decide which redirectId to use
    let redirectId = existing?.id ?? id20();

    // Build provider URL: ONLY [identifier] is replaced with redirectId
    const replaced = replaceTokens(project.surveyLiveUrl!, {
      projectId: projectDbId,
      supplierId,
      identifier: redirectId
    });

    let dest: URL;
    try {
      dest = new URL(replaced);
    } catch {
      const base = (process.env.SURVEY_PROVIDER_BASE_URL || "").trim();
      if (!base) throw new Error("SURVEY_PROVIDER_BASE_URL not set for relative URL");
      dest = new URL(replaced, base);
    }
    if (!isHttp(dest)) throw new Error("Live URL must be http(s)");

    // ---- Persist (collision-safe)
    if (existing) {
      // Update the destination if we already have a row for this triple
      await prisma.surveyRedirect.update({
        where: { id: existing.id },
        data: { destination: dest.toString() }
      });
      redirectId = existing.id; // keep the same outward id
    } else {
      try {
        await prisma.surveyRedirect.create({
          data: {
            id: redirectId,                     // outward id used in provider URL
            projectId: projectDbId,
            supplierId: supplierId || null,
            externalId: externalOriginal || null, // store supplier’s original id (389)
            destination: dest.toString()
          }
        });
      } catch (e: any) {
        if (!isUniqueViolation(e)) throw e;
        // Extremely rare: two parallel creates with same id → turn into update
        await prisma.surveyRedirect.update({
          where: { id: redirectId },
          data: {
            projectId: projectDbId,
            supplierId: supplierId || null,
            externalId: externalOriginal || null,
            destination: dest.toString()
          }
        });
      }
    }

    // ---- Redirect browser
    return NextResponse.redirect(dest.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to build survey live redirect" },
      { status: 400 }
    );
  }
}