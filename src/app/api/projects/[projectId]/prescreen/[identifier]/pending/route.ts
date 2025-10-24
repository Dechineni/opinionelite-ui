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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const { projectId, identifier } = await ctx.params;

  try {
    const projId = await resolveProjectId(projectId);

    // supplierId from querystring
    const url = new URL(req.url);
    const supplierId = url.searchParams.get("supplierId") || undefined;

    // Ensure a respondent row exists (scoped by project + externalId + supplierId)
    let respondent;
    try {
      respondent = await prisma.respondent.upsert({
        where: {
          projectId_externalId_supplierId: {
            projectId: projId,
            externalId: identifier,
            supplierId: supplierId ?? null,
          },
        },
        create: {
          projectId: projId,
          externalId: identifier,
          supplierId: supplierId ?? null,
        },
        update: { supplierId: supplierId ?? null },
      });
    } catch {
      respondent = await prisma.respondent.findFirst({
        where: { projectId: projId, externalId: identifier, supplierId: supplierId ?? null },
      });
    }

    // Already-answered question ids for this respondent
    const existing = await prisma.prescreenAnswer.findMany({
      where: { respondentId: respondent!.id },
      select: { questionId: true },
    });
    const answered = new Set(existing.map((a) => a.questionId));

    // All project questions
    const questions = await prisma.prescreenQuestion.findMany({
      where: { projectId: projId },
      orderBy: { sortOrder: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    // Only pending
    const pending = questions
      .filter((q) => !answered.has(q.id))
      .map((q) => ({
        id: q.id,
        title: q.title,
        question: q.question,
        controlType: q.controlType,
        textMinLength: q.textMinLength,
        textMaxLength: q.textMaxLength,
        textType: q.textType,
        options: q.options?.map((o) => ({ id: o.id, label: o.label, value: o.value })),
      }));

    return NextResponse.json({ items: pending });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load pending prescreen" },
      { status: 500 }
    );
  }
}