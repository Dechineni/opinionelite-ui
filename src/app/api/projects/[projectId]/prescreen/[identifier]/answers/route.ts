// FILE: src/app/api/projects/[projectId]/prescreen/[identifier]/answers/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

async function resolveProjectId(prisma: PrismaClientLike, projectIdOrCode: string) {
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true },
  });
  if (!p) throw new Error("Project not found");
  return p.id;
}

// A very small interface so we don't pull Prisma types at runtime here
type PrismaClientLike = ReturnType<typeof getPrisma>;

type AnswerPayload = { questionId: string; value: string | string[] };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();

    // supplierId: normalize to string | null
    const supplierId: string | null =
      typeof body?.supplierId === "string" && body.supplierId.trim() !== ""
        ? body.supplierId.trim()
        : null;

    // answers: sanitize + cap to avoid huge payloads burning CPU
    const raw: unknown = body?.answers;
    const answers: AnswerPayload[] = Array.isArray(raw)
      ? (raw as AnswerPayload[]).slice(0, 100) // cap 100 answers per call
      : [];

    if (answers.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const projId = await resolveProjectId(prisma, projectId);

    // Ensure respondent (NULL cannot participate in composite upsert)
    let respondentId: string;

    if (supplierId === null) {
      const existing = await prisma.respondent.findFirst({
        where: { projectId: projId, externalId: identifier, supplierId: null },
        select: { id: true },
      });

      if (existing) {
        respondentId = existing.id;
      } else {
        const created = await prisma.respondent.create({
          data: { projectId: projId, externalId: identifier, supplierId: null },
          select: { id: true },
        });
        respondentId = created.id;
      }
    } else {
      const r = await prisma.respondent.upsert({
        where: {
          projectId_externalId_supplierId: {
            projectId: projId,
            externalId: identifier,
            supplierId,
          },
        },
        create: { projectId: projId, externalId: identifier, supplierId },
        update: { supplierId },
        select: { id: true },
      });
      respondentId = r.id;
    }

    // Build all upserts, then do a single transaction
    const now = new Date();
    const ops = answers.map((a) => {
      const isArray = Array.isArray(a.value);
      const selectedValues = isArray
        ? (a.value as unknown[]).filter((v) => typeof v === "string").slice(0, 50) // cap multi-selects
        : [];

      const answerText = isArray ? null : String(a.value ?? "");
      const answerValue = isArray ? null : String(a.value ?? "");

      return prisma.prescreenAnswer.upsert({
        where: {
          respondentId_questionId: {
            respondentId,
            questionId: String(a.questionId),
          },
        },
        create: {
          projectId: projId,
          respondentId,
          questionId: String(a.questionId),
          answerText,
          answerValue,
          selectedValues,
          answeredAt: now,
        },
        update: {
          answerText,
          answerValue,
          selectedValues,
          answeredAt: now,
        },
      });
    });

    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true, saved: ops.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save answers" },
      { status: 500 }
    );
  }
}