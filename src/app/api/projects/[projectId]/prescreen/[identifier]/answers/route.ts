import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function resolveProjectId(projectIdOrCode: string) {
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true },
  });
  if (!p) throw new Error("Project not found");
  return p.id;
}

type AnswerPayload = { questionId: string; value: string | string[] };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();
    const supplierId: string | null = body?.supplierId ?? null;
    const answers: AnswerPayload[] = Array.isArray(body?.answers) ? body.answers : [];

    if (!answers.length) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const projId = await resolveProjectId(projectId);

    // Ensure respondent (scoped by supplier)
    let respondent;
    try {
      respondent = await prisma.respondent.upsert({
        where: {
          projectId_externalId_supplierId: {
            projectId: projId,
            externalId: identifier,
            supplierId: supplierId,
          },
        },
        create: {
          projectId: projId,
          externalId: identifier,
          supplierId: supplierId,
        },
        update: { supplierId: supplierId },
      });
    } catch {
      respondent = await prisma.respondent.findFirst({
        where: { projectId: projId, externalId: identifier, supplierId: supplierId },
      });
    }
    if (!respondent) throw new Error("Respondent not found/created");

    // Upsert each answer
    let saved = 0;

    for (const a of answers as AnswerPayload[]) {
      const isArray = Array.isArray(a.value);
      const answerText = !isArray ? String(a.value ?? "") : null;
      const answerValue = !isArray ? String(a.value ?? "") : null;
      const selectedValues = isArray ? (a.value as string[]) : [];

      await prisma.prescreenAnswer.upsert({
        where: {
          respondentId_questionId: {
            respondentId: respondent.id,
            questionId: a.questionId,
          },
        },
        create: {
          projectId: projId,
          respondentId: respondent.id,
          questionId: a.questionId,
          answerText: isArray ? null : answerText,
          answerValue: isArray ? null : answerValue,
          selectedValues: isArray ? selectedValues : [],
        },
        update: {
          answerText: isArray ? null : answerText,
          answerValue: isArray ? null : answerValue,
          selectedValues: isArray ? selectedValues : [],
          answeredAt: new Date(),
        },
      });

      saved += 1;
    }

    return NextResponse.json({ ok: true, saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save answers" },
      { status: 500 }
    );
  }
}