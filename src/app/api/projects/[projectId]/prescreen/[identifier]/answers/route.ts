// File: src/app/api/projects/[projectId]/prescreen/[identifier]/answers/route.ts
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

async function resolveProjectId(
  prisma: PrismaClientLike,
  projectIdOrCode: string
) {
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }],
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project.id;
}

type AnswerPayload = {
  questionId: string;
  value: string | string[];
};

/**
 * Process array items with limited concurrency to avoid CPU spikes on Edge.
 */
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

  const workers = Array.from(
    {
      length: Math.max(1, Math.min(limit, arr.length)),
    },
    worker
  );

  await Promise.all(workers);

  return out;
}

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function parseNumberLike(val: unknown): number | null {
  const n = Number(
    String(val ?? "").replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : null;
}

/**
 * Finalize an entrant when Prescreen fails.
 *
 * Do not use updateMany here. Cloudflare Edge uses Neon HTTP mode,
 * where Prisma updateMany may attempt a transaction.
 *
 * Tracking failure must not block the respondent from reaching
 * the Terminate Thanks page.
 */
async function finalizePrescreenFailure(
  prisma: PrismaClientLike,
  params: {
    projectId: string;
    supplierCode: string | null;
    externalId: string;
  }
): Promise<void> {
  const { projectId, supplierCode, externalId } = params;

  try {
    let matchedEntry:
      | {
          id: string;
          supplierCode: string;
          finalOutcome: string | null;
        }
      | null = null;

    /*
     * Normal supplier traffic has all three values and can use the
     * compound unique key.
     */
    if (supplierCode) {
      matchedEntry = await prisma.supplierEntry.findUnique({
        where: {
          projectId_supplierCode_externalId: {
            projectId,
            supplierCode,
            externalId,
          },
        },
        select: {
          id: true,
          supplierCode: true,
          finalOutcome: true,
        },
      });
    }

    /*
     * Safe fallback for a request where supplierCode is missing or
     * does not match a legacy value.
     *
     * Only accept the fallback when exactly one entry exists for
     * the project and external ID.
     */
    if (!matchedEntry) {
      const candidates = await prisma.supplierEntry.findMany({
        where: {
          projectId,
          externalId,
        },
        select: {
          id: true,
          supplierCode: true,
          finalOutcome: true,
        },
        take: 2,
      });

      if (candidates.length === 1) {
        matchedEntry = candidates[0];
      } else if (candidates.length > 1) {
        console.warn(
          "Prescreen failure SupplierEntry finalization skipped because multiple entries matched:",
          {
            projectId,
            supplierCode,
            externalId,
            candidateSupplierCodes: candidates.map(
              (entry) => entry.supplierCode
            ),
          }
        );

        return;
      }
    }

    if (!matchedEntry) {
      console.warn(
        "No SupplierEntry found for Prescreen failure:",
        {
          projectId,
          supplierCode,
          externalId,
        }
      );

      return;
    }

    /*
     * Preserve the first final result if the Prescreen request is
     * submitted more than once.
     */
    if (matchedEntry.finalOutcome !== null) {
      console.log(
        "SupplierEntry already finalized; Prescreen failure update ignored:",
        {
          supplierEntryId: matchedEntry.id,
          projectId,
          supplierCode: matchedEntry.supplierCode,
          externalId,
          existingFinalOutcome: matchedEntry.finalOutcome,
        }
      );

      return;
    }

    await prisma.supplierEntry.update({
      where: {
        id: matchedEntry.id,
      },
      data: {
        currentStage: "FINALIZED",
        finalOutcome: "TERMINATE",
        finalOutcomeAt: new Date(),
        finalSource: "PRESCREEN_FAIL",
      },
    });

    console.log(
      "SupplierEntry finalized for Prescreen failure:",
      {
        supplierEntryId: matchedEntry.id,
        projectId,
        supplierCode: matchedEntry.supplierCode,
        externalId,
        finalOutcome: "TERMINATE",
      }
    );
  } catch (error) {
    console.error(
      "Failed to finalize SupplierEntry for Prescreen failure:",
      error
    );
  }
}

export async function POST(
  req: Request,
  ctx: {
    params: Promise<{
      projectId: string;
      identifier: string;
    }>;
  }
) {
  const prisma = getPrisma();
  const { projectId, identifier } = await ctx.params;

  try {
    const body = await req.json();

    const supplierId: string | null =
      typeof body?.supplierId === "string" &&
      body.supplierId.trim() !== ""
        ? body.supplierId.trim()
        : null;

    const raw: unknown = body?.answers;

    const answers: AnswerPayload[] = Array.isArray(raw)
      ? (raw as AnswerPayload[]).slice(0, 100)
      : [];

    const projId = await resolveProjectId(
      prisma,
      projectId
    );

    if (answers.length === 0) {
      await finalizePrescreenFailure(prisma, {
        projectId: projId,
        supplierCode: supplierId,
        externalId: identifier,
      });

      return NextResponse.json({
        ok: true,
        saved: 0,
        pass: false,
        projectId: projId,
        respondentId: identifier,
        supplierId,
        stage: "prescreen",
      });
    }

    // ---------- Ensure respondent ----------
    let respondentId: string | null = null;

    if (supplierId === null) {
      const found = await prisma.respondent.findFirst({
        where: {
          projectId: projId,
          externalId: identifier,
          supplierId: null,
        },
        select: {
          id: true,
        },
      });

      if (found) {
        respondentId = found.id;
      } else {
        try {
          const created =
            await prisma.respondent.create({
              data: {
                projectId: projId,
                externalId: identifier,
                supplierId: null,
              },
              select: {
                id: true,
              },
            });

          respondentId = created.id;
        } catch (e) {
          if (isUniqueViolation(e)) {
            const again =
              await prisma.respondent.findFirst({
                where: {
                  projectId: projId,
                  externalId: identifier,
                  supplierId: null,
                },
                select: {
                  id: true,
                },
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
        select: {
          id: true,
        },
      });

      if (found) {
        respondentId = found.id;
      } else {
        try {
          const created =
            await prisma.respondent.create({
              data: {
                projectId: projId,
                externalId: identifier,
                supplierId,
              },
              select: {
                id: true,
              },
            });

          respondentId = created.id;
        } catch (e) {
          if (isUniqueViolation(e)) {
            const again =
              await prisma.respondent.findUnique({
                where: {
                  projectId_externalId_supplierId: {
                    projectId: projId,
                    externalId: identifier,
                    supplierId,
                  },
                },
                select: {
                  id: true,
                },
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
        {
          error: "Failed to ensure respondent",
        },
        {
          status: 500,
        }
      );
    }

    const qids = answers.map((answer) =>
      String(answer.questionId)
    );

    const questions =
      await prisma.prescreenQuestion.findMany({
        where: {
          projectId: projId,
          id: {
            in: qids,
          },
        },
        select: {
          id: true,
          controlType: true,
          textMinLength: true,
          textMaxLength: true,
          options: {
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              label: true,
              value: true,
              enabled: true,
              validate: true,
            },
          },
        },
      });

    const questionMap = new Map(
      questions.map((question) => [
        question.id,
        question,
      ])
    );

    const filtered = answers.filter((answer) =>
      questionMap.has(String(answer.questionId))
    );

    if (filtered.length === 0) {
      await finalizePrescreenFailure(prisma, {
        projectId: projId,
        supplierCode: supplierId,
        externalId: identifier,
      });

      return NextResponse.json({
        ok: true,
        saved: 0,
        pass: false,
        projectId: projId,
        respondentId,
        supplierId,
        stage: "prescreen",
      });
    }

    // ---------- Write answers ----------
    const now = new Date();

    const results = await mapWithConcurrency(
      filtered,
      8,
      async (answer) => {
        const isArray = Array.isArray(answer.value);

        const selectedValues = isArray
          ? (answer.value as unknown[])
              .filter(
                (value) => typeof value === "string"
              )
              .slice(0, 50)
              .map((value) => String(value))
          : [];

        const answerText = isArray
          ? null
          : String(answer.value ?? "");

        const answerValue = isArray
          ? null
          : String(answer.value ?? "");

        try {
          await prisma.prescreenAnswer.deleteMany({
            where: {
              respondentId,
              questionId: String(answer.questionId),
            },
          });

          await prisma.prescreenAnswer.create({
            data: {
              projectId: projId,
              respondentId,
              questionId: String(
                answer.questionId
              ),
              answerText,
              answerValue,
              selectedValues,
              answeredAt: now,
            },
          });

          return true;
        } catch (e: any) {
          if (
            String(e?.message || "").includes(
              "Transactions are not supported in HTTP mode"
            )
          ) {
            return true;
          }

          return false;
        }
      }
    );

    const saved = results.reduce(
      (count, ok) => count + (ok ? 1 : 0),
      0
    );

    // ---------- Evaluate pass/fail ----------
    let pass = true;

    for (const answer of filtered) {
      const question = questionMap.get(
        String(answer.questionId)
      );

      if (!question) {
        pass = false;
        break;
      }

      const controlType = String(
        question.controlType || ""
      ).toUpperCase();

      if (controlType === "TEXT") {
        const rawValue = Array.isArray(answer.value)
          ? ""
          : String(answer.value ?? "").trim();

        if (!rawValue) {
          pass = false;
          break;
        }

        const min = question.textMinLength ?? 0;
        const max = question.textMaxLength ?? 0;

        if (min || max) {
          const value = parseNumberLike(rawValue);

          if (value == null) {
            pass = false;
            break;
          }

          if (min && value < min) {
            pass = false;
            break;
          }

          if (max && value > max) {
            pass = false;
            break;
          }
        }

        continue;
      }

      const options = Array.isArray(
        question.options
      )
        ? question.options
        : [];

      const allowed = new Set(
        options
          .filter(
            (option) =>
              Boolean(option.enabled) &&
              Boolean(option.validate)
          )
          .map((option) =>
            norm(option.value || option.label || "")
          )
          .filter(Boolean)
      );

      /*
       * If no validate-enabled options exist, treat the
       * answered question as passed.
       */
      if (allowed.size === 0) {
        continue;
      }

      if (
        controlType === "RADIO" ||
        controlType === "DROPDOWN"
      ) {
        const value = Array.isArray(answer.value)
          ? ""
          : norm(answer.value);

        if (!value || !allowed.has(value)) {
          pass = false;
          break;
        }

        continue;
      }

      if (controlType === "CHECKBOX") {
        const picked = Array.isArray(answer.value)
          ? answer.value.map(norm)
          : [];

        const anyMatch = picked.some((value) =>
          allowed.has(value)
        );

        if (!anyMatch) {
          pass = false;
          break;
        }

        continue;
      }
    }

    /*
     * Prescreen failure is a final respondent outcome.
     * Finalize SupplierEntry before the client redirects
     * to /Thanks?status=TERMINATE.
     */
    if (!pass) {
      await finalizePrescreenFailure(prisma, {
        projectId: projId,
        supplierCode: supplierId,
        externalId: identifier,
      });
    }

    return NextResponse.json({
      ok: true,
      saved,
      pass,
      projectId: projId,
      respondentId,
      supplierId,
      stage: "prescreen",
    });
  } catch (err: any) {
    const msg = String(
      err?.message || "Failed to save answers"
    );

    if (
      msg.includes(
        "Transactions are not supported in HTTP mode"
      )
    ) {
      return NextResponse.json({
        ok: true,
        saved: 0,
        pass: false,
        stage: "prescreen",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        stage: "prescreen",
      },
      {
        status: 500,
      }
    );
  }
}