export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/** A tiny type so we don't import Prisma at runtime */
type PrismaClientLike = ReturnType<typeof getPrisma>;

const isUniqueViolation = (e: any) => {
  const msg = String(e?.message || "");
  return (
    (e && e.code === "P2002") ||
    /Unique constraint failed/i.test(msg) ||
    /duplicate key value violates unique constraint/i.test(msg)
  );
};

async function resolveProjectId(prisma: PrismaClientLike, projectIdOrCode: string) {
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true },
  });
  if (!p) throw new Error("Project not found");
  return p.id;
}

type AnswerPayload = { questionId: string; value: string | string[] };

/** Process array items with limited concurrency to avoid CPU spikes on Edge */
async function mapWithConcurrency<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;

  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, arr.length)) }, worker);
  await Promise.all(workers);
  return out;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();

    // supplierId → string | null
    const supplierId: string | null =
      typeof body?.supplierId === "string" && body.supplierId.trim() !== ""
        ? body.supplierId.trim()
        : null;

    // answers → sanitize + cap to protect CPU
    const raw: unknown = body?.answers;
    const answers: AnswerPayload[] = Array.isArray(raw)
      ? (raw as AnswerPayload[]).slice(0, 100) // cap 100 per call
      : [];

    if (answers.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const projId = await resolveProjectId(prisma, projectId);

    // ---------- Ensure respondent (collision safe) ----------
    let respondentId: string | null = null;

    if (supplierId === null) {
      const found = await prisma.respondent.findFirst({
        where: { projectId: projId, externalId: identifier, supplierId: null },
        select: { id: true },
      });
      if (found) respondentId = found.id;
      else {
        try {
          const created = await prisma.respondent.create({
            data: { projectId: projId, externalId: identifier, supplierId: null },
            select: { id: true },
          });
          respondentId = created.id;
        } catch (e) {
          if (isUniqueViolation(e)) {
            const again = await prisma.respondent.findFirst({
              where: { projectId: projId, externalId: identifier, supplierId: null },
              select: { id: true },
            });
            respondentId = again?.id ?? null;
          } else {
            throw e;
          }
        }
      }
    } else {
      const found = await prisma.respondent.findUnique({
        where: {
          projectId_externalId_supplierId: {
            projectId: projId,
            externalId: identifier,
            supplierId,
          },
        },
        select: { id: true },
      });
      if (found) respondentId = found.id;
      else {
        try {
          const created = await prisma.respondent.create({
            data: { projectId: projId, externalId: identifier, supplierId },
            select: { id: true },
          });
          respondentId = created.id;
        } catch (e) {
          if (isUniqueViolation(e)) {
            const again = await prisma.respondent.findUnique({
              where: {
                projectId_externalId_supplierId: {
                  projectId: projId,
                  externalId: identifier,
                  supplierId,
                },
              },
              select: { id: true },
            });
            respondentId = again?.id ?? null;
          } else {
            throw e;
          }
        }
      }
    }

    if (!respondentId) {
      return NextResponse.json(
        { error: "Failed to ensure respondent" },
        { status: 500 }
      );
    }

    // Write answers WITHOUT transactions, using small concurrency
    const now = new Date();

    const results = await mapWithConcurrency(answers, 10, async (a) => {
      const isArray = Array.isArray(a.value);
      const selectedValues = isArray
        ? (a.value as unknown[])
            .filter((v) => typeof v === "string")
            .slice(0, 50)
            .map((v) => String(v))
        : [];

      const answerText = isArray ? null : String(a.value ?? "");
      const answerValue = isArray ? null : String(a.value ?? "");

      try {
        await prisma.prescreenAnswer.upsert({
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
        return true;
      } catch {
        return false;
      }
    });

    const saved = results.reduce((n, ok) => n + (ok ? 1 : 0), 0);
    return NextResponse.json({ ok: true, saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save answers" },
      { status: 500 }
    );
  }
}