export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const isP2002 = (e: any) => {
  const msg = String(e?.message || "");

  return (
    (e && e.code === "P2002") ||
    /Unique constraint failed/i.test(msg) ||
    /duplicate key value violates unique constraint/i.test(msg)
  );
};

function mapAuth(aRaw: string | null | undefined) {
  const a = (aRaw || "").toLowerCase().trim();

  if (a === "c" || a === "10") {
    return {
      redirectResult: "COMPLETE" as const,
      eventOutcome: "COMPLETE" as const,
    };
  }

  if (a === "t" || a === "20") {
    return {
      redirectResult: "TERMINATE" as const,
      eventOutcome: "TERMINATE" as const,
    };
  }

  if (a === "q" || a === "40") {
    return {
      redirectResult: "OVERQUOTA" as const,
      eventOutcome: "OVER_QUOTA" as const,
    };
  }

  if (a === "f" || a === "30") {
    return {
      redirectResult: "QUALITYTERM" as const,
      eventOutcome: "QUALITY_TERM" as const,
    };
  }

  if (a === "sc" || a === "70") {
    return {
      redirectResult: "CLOSE" as const,
      eventOutcome: "SURVEY_CLOSE" as const,
    };
  }

  return {
    redirectResult: null,
    eventOutcome: null,
  };
}

function fillIdentifier(rawUrl: string, identifier: string) {
  try {
    const u = new URL(rawUrl);

    u.searchParams.forEach((v, k) => {
      if (/\[identifier\]/i.test(v)) {
        u.searchParams.set(
          k,
          v.replace(/\[identifier\]/gi, identifier)
        );
      }

      if (
        ["id", "rid"].includes(k.toLowerCase()) &&
        v.toLowerCase() === "identifier"
      ) {
        u.searchParams.set(k, identifier);
      }
    });

    let s = u.toString();

    s = s.replace(/\[identifier\]/gi, identifier);

    return s;
  } catch {
    return rawUrl
      .replace(/\[identifier\]/gi, identifier)
      .replace(/(id|rid)=identifier/gi, `$1=${identifier}`);
  }
}

const looksLikePid = (s: string) => /^[0-9A-Za-z]{20}$/.test(s);

function isTestSupplier(
  supplier:
    | {
      code?: string | null;
      name?: string | null;
    }
    | null
    | undefined
) {
  const code = String(supplier?.code || "")
    .trim()
    .toLowerCase();

  const name = String(supplier?.name || "")
    .trim()
    .toLowerCase();

  return (
    name === "test supplier" ||
    code === "test_supplier" ||
    code === "test" ||
    code === "testsupplier"
  );
}

export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const url = new URL(req.url);

    const auth = url.searchParams.get("auth");

    const rawRid = (
      url.searchParams.get("pid") ||
      url.searchParams.get("rid") ||
      ""
    ).trim();

    const memberCode = (
      url.searchParams.get("MemberCode") || ""
    ).trim();

    const ridIn =
      rawRid && !/^\[[^\]]+\]$/.test(rawRid)
        ? rawRid
        : "";

    const callbackExternalId =
      memberCode || (!looksLikePid(ridIn) ? ridIn : "");

    const mapped = mapAuth(auth);

    if (!mapped.redirectResult || !mapped.eventOutcome) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid or missing auth",
        },
        {
          status: 400,
        }
      );
    }

    if (!ridIn && !callbackExternalId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing pid/rid and MemberCode",
        },
        {
          status: 400,
        }
      );
    }

    let redirect =
      ridIn && looksLikePid(ridIn)
        ? await prisma.surveyRedirect.findUnique({
          where: {
            id: ridIn,
          },
          select: {
            id: true,
            projectId: true,
            supplierId: true,
            respondentId: true,
            externalId: true,
            destination: true,
            result: true,
          },
        })
        : null;

    if (!redirect && callbackExternalId) {
      redirect = await prisma.surveyRedirect.findFirst({
        where: {
          externalId: callbackExternalId,
          result: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          projectId: true,
          supplierId: true,
          respondentId: true,
          externalId: true,
          destination: true,
          result: true,
        },
      });

      if (!redirect) {
        redirect = await prisma.surveyRedirect.findFirst({
          where: {
            externalId: callbackExternalId,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            projectId: true,
            supplierId: true,
            respondentId: true,
            externalId: true,
            destination: true,
            result: true,
          },
        });
      }
    }

    if (!redirect) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Redirect context not found. (pid/externalId mismatch)",
        },
        {
          status: 400,
        }
      );
    }

    const pid = redirect.id;
    const projectId = redirect.projectId ?? null;
    const supplierId = redirect.supplierId ?? null;
    const externalId = redirect.externalId ?? null;

    let supplierRecord:
      | {
        id: string;
        code: string;
        name: string | null;
        completeUrl: string | null;
        terminateUrl: string | null;
        overQuotaUrl: string | null;
        qualityTermUrl: string | null;
        surveyCloseUrl: string | null;
      }
      | null = null;

    if (supplierId) {
      /*
       * Some older records may contain the Supplier database ID,
       * while current SurveyRedirect rows generally contain the
       * supplier code such as S1007.
       */
      supplierRecord = await prisma.supplier.findUnique({
        where: {
          id: supplierId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          completeUrl: true,
          terminateUrl: true,
          overQuotaUrl: true,
          qualityTermUrl: true,
          surveyCloseUrl: true,
        },
      });

      if (!supplierRecord) {
        supplierRecord = await prisma.supplier.findUnique({
          where: {
            code: supplierId,
          },
          select: {
            id: true,
            code: true,
            name: true,
            completeUrl: true,
            terminateUrl: true,
            overQuotaUrl: true,
            qualityTermUrl: true,
            surveyCloseUrl: true,
          },
        });
      }
    }

    const supplierIdForEvent = supplierRecord?.id ?? null;

    let respondentId = redirect.respondentId ?? null;

    if (!respondentId && projectId && externalId) {
      if (supplierId) {
        try {
          const created = await prisma.respondent.create({
            data: {
              projectId,
              externalId,
              supplierId,
            },
            select: {
              id: true,
            },
          });

          respondentId = created.id;
        } catch (e) {
          if (isP2002(e)) {
            const found = await prisma.respondent.findUnique({
              where: {
                projectId_externalId_supplierId: {
                  projectId,
                  externalId,
                  supplierId,
                },
              },
              select: {
                id: true,
              },
            });

            respondentId = found?.id ?? null;
          } else {
            throw e;
          }
        }
      } else {
        const found = await prisma.respondent.findFirst({
          where: {
            projectId,
            externalId,
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
            const created = await prisma.respondent.create({
              data: {
                projectId,
                externalId,
                supplierId: null,
              },
              select: {
                id: true,
              },
            });

            respondentId = created.id;
          } catch (e) {
            if (isP2002(e)) {
              const again = await prisma.respondent.findFirst({
                where: {
                  projectId,
                  externalId,
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
      }

      prisma.surveyRedirect
        .update({
          where: {
            id: pid,
          },
          data: {
            respondentId,
          },
        })
        .catch(() => { });
    }

    if (redirect.result !== mapped.redirectResult) {
      await prisma.surveyRedirect
        .update({
          where: {
            id: pid,
          },
          data: {
            result: mapped.redirectResult,
          },
        })
        .catch(() => { });
    }

    /*
     * Finalize the initial SupplierEntry using the original context
     * resolved from SurveyRedirect.
     *
     * SupplierEntry stores:
     * - Project database ID in projectId
     * - Supplier code such as S1007 in supplierCode
     * - Original supplier respondent ID in externalId
     *
     * Do not use the callback rid as the SupplierEntry externalId,
     * because rid is the generated SurveyRedirect PID.
     */
    if (projectId && externalId) {
      // These values are guaranteed to be strings inside this block.
      const entryProjectId = projectId;
      const entryExternalId = externalId;

      try {
        const finalizedAt = new Date();

        const redirectSupplierValue = String(
          redirect.supplierId || ""
        ).trim();

        const resolvedSupplierCode = String(
          supplierRecord?.code || ""
        ).trim();

        let updatedRows = 0;
        let matchedSupplierCode: string | null = null;

        /*
         * Primary match:
         * SurveyRedirect.supplierId normally stores the supplier code.
         */
        if (redirectSupplierValue) {
          const primaryUpdate =
            await prisma.supplierEntry.updateMany({
              where: {
                projectId: entryProjectId,
                supplierCode: redirectSupplierValue,
                externalId: entryExternalId,
                finalOutcome: null,
              },
              data: {
                currentStage: "FINALIZED",
                finalOutcome: mapped.eventOutcome,
                finalOutcomeAt: finalizedAt,
              },
            });

          updatedRows += primaryUpdate.count;

          if (primaryUpdate.count > 0) {
            matchedSupplierCode = redirectSupplierValue;
          }
        }

        /*
         * Secondary match:
         * Use the supplier record's code when SurveyRedirect contains
         * a Supplier database ID or another legacy supplier value.
         */
        if (
          updatedRows === 0 &&
          resolvedSupplierCode &&
          resolvedSupplierCode !== redirectSupplierValue
        ) {
          const secondaryUpdate =
            await prisma.supplierEntry.updateMany({
              where: {
                projectId: entryProjectId,
                supplierCode: resolvedSupplierCode,
                externalId: entryExternalId,
                finalOutcome: null,
              },
              data: {
                currentStage: "FINALIZED",
                finalOutcome: mapped.eventOutcome,
                finalOutcomeAt: finalizedAt,
              },
            });

          updatedRows += secondaryUpdate.count;

          if (secondaryUpdate.count > 0) {
            matchedSupplierCode = resolvedSupplierCode;
          }
        }

        /*
         * Final safe fallback:
         * If there is exactly one unfinished SupplierEntry for the
         * same project and external ID, update that row.
         *
         * This avoids updating the wrong supplier when the same
         * external ID exists under multiple suppliers.
         */
        if (updatedRows === 0) {
          const candidateEntries =
            await prisma.supplierEntry.findMany({
              where: {
                projectId: entryProjectId,
                externalId: entryExternalId,
                finalOutcome: null,
              },
              select: {
                id: true,
                supplierCode: true,
              },
              take: 2,
            });

          if (candidateEntries.length === 1) {
            await prisma.supplierEntry.update({
              where: {
                id: candidateEntries[0].id,
              },
              data: {
                currentStage: "FINALIZED",
                finalOutcome: mapped.eventOutcome,
                finalOutcomeAt: finalizedAt,
              },
            });

            updatedRows = 1;
            matchedSupplierCode =
              candidateEntries[0].supplierCode;
          } else if (candidateEntries.length > 1) {
            console.warn(
              "SupplierEntry finalization skipped because multiple unfinished entries matched the same project and external ID:",
              {
                pid,
                projectId: redirect.projectId,
                externalId: redirect.externalId,
                redirectSupplierValue,
                resolvedSupplierCode,
                candidateSupplierCodes:
                  candidateEntries.map(
                    (entry) => entry.supplierCode
                  ),
              }
            );
          }
        }

        console.log("SupplierEntry finalization result:", {
          updatedRows,
          pid,
          projectId: entryProjectId,
          redirectSupplierValue,
          resolvedSupplierCode,
          matchedSupplierCode,
          externalId: entryExternalId,
          finalOutcome: mapped.eventOutcome,
        });

        if (updatedRows === 0) {
          console.warn(
            "No unfinished SupplierEntry row was finalized:",
            {
              pid,
              projectId: entryProjectId,
              redirectSupplierValue,
              resolvedSupplierCode,
              externalId: entryExternalId,
              finalOutcome: mapped.eventOutcome,
            }
          );
        }
      } catch (entryError) {
        /*
         * SupplierEntry tracking failure must never block the existing
         * result count or respondent redirect flow.
         */
        console.error(
          "Failed to finalize SupplierEntry:",
          entryError
        );
      }
    } else {
      console.warn(
        "SupplierEntry finalization skipped because redirect context is incomplete:",
        {
          pid,
          projectId,
          supplierId,
          externalId,
          finalOutcome: mapped.eventOutcome,
        }
      );
    }

    if (projectId) {
      try {
        await prisma.supplierRedirectEvent.create({
          data: {
            projectId,
            supplierId: supplierIdForEvent,
            respondentId: respondentId ?? null,
            pid,
            outcome: mapped.eventOutcome as any,
          },
        });
      } catch (e) {
        console.log("prisma:error", e);
      }
    }

    let nextUrl: string | null = null;

    const supplierIdent =
      supplierRecord?.id || pid || externalId || "";

    if (supplierRecord) {
      const r = mapped.redirectResult;

      const tpl =
        r === "COMPLETE"
          ? supplierRecord.completeUrl
          : r === "TERMINATE"
            ? supplierRecord.terminateUrl
            : r === "OVERQUOTA"
              ? supplierRecord.overQuotaUrl
              : r === "QUALITYTERM"
                ? supplierRecord.qualityTermUrl
                : r === "CLOSE"
                  ? supplierRecord.surveyCloseUrl
                  : null;

      if (tpl) {
        nextUrl = fillIdentifier(tpl, supplierIdent);
      }
    }

    /*
     * Only Test Supplier COMPLETE should fall back to
     * the OP Panel complete page.
     */
    if (
      !nextUrl &&
      mapped.redirectResult === "COMPLETE" &&
      isTestSupplier(supplierRecord)
    ) {
      const opPanelBase =
        (process.env.OP_PANEL_API_BASE || "").trim() ||
        "https://opinionelite.com";

      const u = new URL(
        "/UI/complete.php",
        opPanelBase.replace(/\/$/, "") + "/"
      );

      u.searchParams.set("pid", pid);

      if (externalId) {
        u.searchParams.set("id", externalId);
      }

      nextUrl = u.toString();
    }

    const thanksUrl = new URL("/Thanks", url.origin);

    thanksUrl.searchParams.set(
      "status",
      mapped.redirectResult
    );

    thanksUrl.searchParams.set("pid", pid);

    if (nextUrl) {
      thanksUrl.searchParams.set("next", nextUrl);
    }

    return NextResponse.redirect(thanksUrl.toString(), {
      status: 302,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "server error",
      },
      {
        status: 500,
      }
    );
  }
}