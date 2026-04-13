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

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function parseNumberLike(val: unknown): number | null {
  const n = Number(String(val ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; identifier: string }> }
) {
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();

    const supplierId: string | null =
      typeof body?.supplierId === "string" && body.supplierId.trim() !== ""
        ? body.supplierId.trim()
        : null;

    const raw: unknown = body?.answers;
    const answers: AnswerPayload[] = Array.isArray(raw)
      ? (raw as AnswerPayload[]).slice(0, 100)
      : [];

    if (answers.length === 0) {
      return NextResponse.json({ ok: true, saved: 0, pass: false });
    }

    const projId = await resolveProjectId(prisma, projectId);

    // ---------- Ensure respondent ----------
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
      return NextResponse.json({ error: "Failed to ensure respondent" }, { status: 500 });
    }

    const qids = answers.map((a) => String(a.questionId));

    const questions = await prisma.prescreenQuestion.findMany({
      where: { projectId: projId, id: { in: qids } },
      select: {
        id: true,
        controlType: true,
        textMinLength: true,
        textMaxLength: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: {
            label: true,
            value: true,
            enabled: true,
            validate: true,
          },
        },
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const filtered = answers.filter((a) => questionMap.has(String(a.questionId)));

    if (filtered.length === 0) {
      return NextResponse.json({ ok: true, saved: 0, pass: false });
    }

    // ---------- Write answers ----------
    const now = new Date();

    const results = await mapWithConcurrency(filtered, 8, async (a) => {
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
        await prisma.prescreenAnswer.deleteMany({
          where: {
            respondentId,
            questionId: String(a.questionId),
          },
        });

        await prisma.prescreenAnswer.create({
          data: {
            projectId: projId,
            respondentId,
            questionId: String(a.questionId),
            answerText,
            answerValue,
            selectedValues,
            answeredAt: now,
          },
        });

        return true;
      } catch (e: any) {
        if (String(e?.message || "").includes("Transactions are not supported in HTTP mode")) {
          return true;
        }
        return false;
      }
    });

    const saved = results.reduce((n, ok) => n + (ok ? 1 : 0), 0);

    // ---------- Evaluate pass/fail ----------
    let pass = true;

    for (const a of filtered) {
      const q = questionMap.get(String(a.questionId));
      if (!q) {
        pass = false;
        break;
      }

      const controlType = String(q.controlType || "").toUpperCase();

      if (controlType === "TEXT") {
        const rawVal = Array.isArray(a.value) ? "" : String(a.value ?? "").trim();
        if (!rawVal) {
          pass = false;
          break;
        }

        const min = q.textMinLength ?? 0;
        const max = q.textMaxLength ?? 0;

        if (min || max) {
          const n = parseNumberLike(rawVal);
          if (n == null) {
            pass = false;
            break;
          }
          if (min && n < min) {
            pass = false;
            break;
          }
          if (max && n > max) {
            pass = false;
            break;
          }
        }
        continue;
      }

      const opts = Array.isArray(q.options) ? q.options : [];
      const allowed = new Set(
        opts
          .filter((o) => Boolean(o.enabled) && Boolean(o.validate))
          .map((o) => norm(o.value || o.label || ""))
          .filter(Boolean)
      );

      // If no validate-enabled options exist, treat as pass once answered
      if (allowed.size === 0) {
        continue;
      }

      if (controlType === "RADIO" || controlType === "DROPDOWN") {
        const v = Array.isArray(a.value) ? "" : norm(a.value);
        if (!v || !allowed.has(v)) {
          pass = false;
          break;
        }
        continue;
      }

      if (controlType === "CHECKBOX") {
        const picked = Array.isArray(a.value) ? a.value.map(norm) : [];
        const anyMatch = picked.some((x) => allowed.has(x));
        if (!anyMatch) {
          pass = false;
          break;
        }
        continue;
      }
    }

    return NextResponse.json({ ok: true, saved, pass });
  } catch (err: any) {
    const msg = String(err?.message || "Failed to save answers");
    if (msg.includes("Transactions are not supported in HTTP mode")) {
      return NextResponse.json({ ok: true, saved: 0, pass: false });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}