export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

async function resolveProjectId(prisma: ReturnType<typeof getPrisma>, projectIdOrCode: string) {
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
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const realProjectId = await resolveProjectId(prisma, projectId);

    // supplierId may be absent or empty -> treat as null consistently
    const url = new URL(req.url);
    const supplierIdQS = (url.searchParams.get("supplierId") || "").trim();
    const supplierId: string | null = supplierIdQS === "" ? null : supplierIdQS;

    // Ensure a respondent row exists with the specific (project, externalId, supplierId|null)
    let respondentId: string;

    if (supplierId === null) {
      // Can't upsert on composite with NULL → find or create
      const existing = await prisma.respondent.findFirst({
        where: { projectId: realProjectId, externalId: identifier, supplierId: null },
        select: { id: true },
      });
      if (existing) {
        respondentId = existing.id;
      } else {
        const created = await prisma.respondent.create({
          data: { projectId: realProjectId, externalId: identifier, supplierId: null },
          select: { id: true },
        });
        respondentId = created.id;
      }
    } else {
      // Non-null supplierId → safe composite upsert
      const up = await prisma.respondent.upsert({
        where: {
          projectId_externalId_supplierId: {
            projectId: realProjectId,
            externalId: identifier,
            supplierId,
          },
        },
        update: {}, // nothing to change; presence is enough
        create: { projectId: realProjectId, externalId: identifier, supplierId },
        select: { id: true },
      });
      respondentId = up.id;
    }

    // Pull answered prescreen question ids for this respondent
    const answeredIds = await prisma.prescreenAnswer.findMany({
      where: { respondentId },
      select: { questionId: true },
    });
    const answeredSet = new Set(answeredIds.map(a => a.questionId));

    // Fetch questions for the project (ordered) with only fields needed on the client
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

    // Only pending questions
    const pending = questions.filter(q => !answeredSet.has(q.id));

    return NextResponse.json({ items: pending });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load pending prescreen" },
      { status: 500 }
    );
  }
}