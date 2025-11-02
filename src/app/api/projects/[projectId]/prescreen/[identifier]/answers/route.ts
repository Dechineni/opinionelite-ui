// FILE: src/app/api/projects/[projectId]/prescreen/[identifier]/answers/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

async function resolveProjectId(projectIdOrCode: string) {
  const prisma = getPrisma();
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
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();

    // Normalize supplierId to string|null
    const supplierId: string | null =
      typeof body?.supplierId === "string" && body.supplierId.trim() !== ""
        ? body.supplierId
        : null;

    const answers: AnswerPayload[] = Array.isArray(body?.answers) ? body.answers : [];
    if (answers.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const projId = await resolveProjectId(projectId);

    // Create / get respondent
    let respondent;
    if (supplierId === null) {
      // ❗ Cannot use upsert with a NULL in a composite unique.
      const existing = await prisma.respondent.findFirst({
        where: { projectId: projId, externalId: identifier, supplierId: null },
      });
      respondent =
        existing ??
        (await prisma.respondent.create({
          data: {
            projectId: projId,
            externalId: identifier,
            supplierId: null,
          },
        }));
      // If you want to ensure null stays null, nothing more to update here
    } else {
      // ✅ Non-null supplierId → safe to use composite unique upsert
      respondent = await prisma.respondent.upsert({
        where: {
          projectId_externalId_supplierId: {
            projectId: projId,
            externalId: identifier,
            supplierId, // string
          },
        },
        create: {
          projectId: projId,
          externalId: identifier,
          supplierId,
        },
        update: {
          supplierId,
        },
      });
    }

    if (!respondent) throw new Error("Respondent not found/created");

    // Upsert each answer
    let saved = 0;
    for (const a of answers) {
      const isArray = Array.isArray(a.value);
      const answerText = isArray ? null : String(a.value ?? "");
      const answerValue = isArray ? null : String(a.value ?? "");
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
          answerText,
          answerValue,
          selectedValues,
        },
        update: {
          answerText,
          answerValue,
          selectedValues,
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