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

    const callbackProjectRef = (
      url.searchParams.get("projectId") ||
      url.searchParams.get("projectCode") ||
      url.searchParams.get("project") ||
      ""
    ).trim();

    const callbackSupplierRef = (
      url.searchParams.get("supplierId") ||
      url.searchParams.get("supplierCode") ||
      url.searchParams.get("supplier") ||
      ""
    ).trim();

    const explicitCallbackRecid = (
      url.searchParams.get("recid") ||
      url.searchParams.get("Recid") ||
      url.searchParams.get("RECID") ||
      url.searchParams.get("APID") ||
      url.searchParams.get("apid") ||
      url.searchParams.get("PanelID") ||
      url.searchParams.get("panelId") ||
      url.searchParams.get("panelid") ||
      ""
    ).trim();

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

    /*
     * Existing flow:
     * - 20-char rid/pid identifies SurveyRedirect directly.
     * - Non-20 rid/pid or MemberCode can be treated as vendor externalId.
     *
     * Single-parameter Recontact flow:
     * - Client may return recid instead of the OpinionElite generated rid/pid.
     * - Manager-approved callback format uses projectId/projectCode as a
     *   static value in the client tool and recid/APID as the only dynamic value.
     * - supplierId is optional. If present, we use it for a stronger match.
     */
    const callbackRecid =
      explicitCallbackRecid ||
      (callbackProjectRef && ridIn && !looksLikePid(ridIn)
        ? ridIn
        : "");

    const callbackExternalId =
      memberCode ||
      (!callbackRecid && !looksLikePid(ridIn) ? ridIn : "");

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

    if (!ridIn && !callbackExternalId && !callbackRecid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing pid/rid, MemberCode, or recid",
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
              recid: true,
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
          recid: true,
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
            recid: true,
          },
        });
      }
    }

    /*
     * Recontact single-parameter callback support.
     *
     * This is used when the client supports only one dynamic respondent value.
     * OpinionElite sends recid to the client in that single parameter, and the
     * client returns the same value back as recid/APID.
     *
     * Required callback context:
     * - projectId/projectCode: static project reference configured in client redirect URL
     * - recid/APID/PanelID: dynamic value returned by client
     *
     * Optional callback context:
     * - supplierId/supplierCode. If present, we use it for a stronger match.
     *
     * Safe matching rule:
     * - Match by projectId + recid.
     * - If supplierId is present, match by projectId + supplierId + recid.
     * - Process only when exactly one pending SurveyRedirect matches.
     * - If multiple pending rows match, stop instead of guessing the wrong
     *   project attempt/vendor externalId.
     */
    if (!redirect && callbackRecid) {
      if (!callbackProjectRef) {
        return NextResponse.json(
          {
            ok: false,
            error: "projectId is required for recid callback.",
          },
          {
            status: 400,
          }
        );
      }

      const callbackProject = await prisma.project.findFirst({
        where: {
          OR: [
            { id: callbackProjectRef },
            { code: callbackProjectRef },
          ],
        },
        select: {
          id: true,
          code: true,
          projectType: true,
        },
      });

      if (!callbackProject) {
        return NextResponse.json(
          {
            ok: false,
            error: "Project not found for recid callback.",
          },
          {
            status: 400,
          }
        );
      }

      if (callbackProject.projectType !== "Recontact") {
        return NextResponse.json(
          {
            ok: false,
            error: "recid callback is only supported for Recontact projects.",
            projectId: callbackProjectRef,
          },
          {
            status: 400,
          }
        );
      }

      let possibleCallbackSupplierRefs: string[] = [];

      if (callbackSupplierRef) {
        const callbackSupplier = await prisma.supplier.findFirst({
          where: {
            OR: [
              { id: callbackSupplierRef },
              { code: callbackSupplierRef },
            ],
          },
          select: {
            id: true,
            code: true,
          },
        });

        possibleCallbackSupplierRefs = Array.from(
          new Set(
            [
              callbackSupplierRef,
              callbackSupplier?.id || "",
              callbackSupplier?.code || "",
            ]
              .map((value) => value.trim())
              .filter(Boolean)
          )
        );
      }

      const pendingMatches =
        await prisma.surveyRedirect.findMany({
          where: {
            projectId: callbackProject.id,
            recid: callbackRecid,
            result: null,
            ...(possibleCallbackSupplierRefs.length > 0
              ? { supplierId: { in: possibleCallbackSupplierRefs } }
              : {}),
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 2,
          select: {
            id: true,
            projectId: true,
            supplierId: true,
            respondentId: true,
            externalId: true,
            destination: true,
            result: true,
            recid: true,
          },
        });

      if (pendingMatches.length > 1) {
        console.warn(
          "Ambiguous recid callback. Multiple pending redirects matched:",
          {
            projectId: callbackProjectRef,
            supplierId: callbackSupplierRef || null,
            recid: callbackRecid,
            matchedPids: pendingMatches.map((match) => match.id),
          }
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Ambiguous recid callback. Multiple pending redirects matched.",
            projectId: callbackProjectRef,
            supplierId: callbackSupplierRef || null,
            recid: callbackRecid,
          },
          {
            status: 409,
          }
        );
      }

      if (pendingMatches.length === 1) {
        redirect = pendingMatches[0];
      }

      if (!redirect) {
        const finalizedMatch =
          await prisma.surveyRedirect.findFirst({
            where: {
              projectId: callbackProject.id,
              recid: callbackRecid,
              result: {
                not: null,
              },
              ...(possibleCallbackSupplierRefs.length > 0
                ? { supplierId: { in: possibleCallbackSupplierRefs } }
                : {}),
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              result: true,
            },
          });

        if (finalizedMatch) {
          return NextResponse.json(
            {
              ok: false,
              error: "Survey already attempted.",
              projectId: callbackProjectRef,
              supplierId: callbackSupplierRef || null,
              recid: callbackRecid,
              priorPid: finalizedMatch.id,
              priorResult: finalizedMatch.result,
            },
            {
              status: 409,
            }
          );
        }
      }
    }

    if (!redirect) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Redirect context not found. (pid/externalId/recid mismatch)",
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
    const recid = redirect.recid ?? null;

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
       * Some older SurveyRedirect rows may contain the Supplier database ID,
       * while current rows generally contain the supplier code, such as S1007.
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
              ...(recid?.trim() ? { recid } : {}),
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
            recid: true,
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
                ...(recid?.trim() ? { recid } : {}),
              },
              select: {
                id: true,
                recid: true,
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
                  recid: true,
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
        .catch(() => {});
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
        .catch(() => {});
    }

    /*
     * Finalize SupplierEntry using the context resolved from SurveyRedirect.
     *
     * Do not use updateMany here. The Cloudflare Edge deployment uses
     * Neon HTTP mode, where Prisma updateMany may require a transaction.
     * Transactions are not supported in that mode.
     */
    if (projectId && externalId) {
      const entryProjectId = projectId;
      const entryExternalId = externalId;

      try {
        const redirectSupplierValue = String(
          redirect.supplierId || ""
        ).trim();

        const resolvedSupplierCode = String(
          supplierRecord?.code || ""
        ).trim();

        const possibleSupplierCodes = Array.from(
          new Set(
            [redirectSupplierValue, resolvedSupplierCode].filter(
              (value): value is string => Boolean(value)
            )
          )
        );

        let matchedEntry:
          | {
              id: string;
              supplierCode: string;
              finalOutcome: string | null;
            }
          | null = null;

        /*
         * Primary lookup using the compound unique key:
         * projectId + supplierCode + externalId.
         */
        for (const supplierCode of possibleSupplierCodes) {
          const entry = await prisma.supplierEntry.findUnique({
            where: {
              projectId_supplierCode_externalId: {
                projectId: entryProjectId,
                supplierCode,
                externalId: entryExternalId,
              },
            },
            select: {
              id: true,
              supplierCode: true,
              finalOutcome: true,
            },
          });

          if (entry) {
            matchedEntry = entry;
            break;
          }
        }

        /*
         * Safe fallback for older or inconsistent supplier values.
         *
         * Only use this fallback when exactly one SupplierEntry exists
         * for the project and external ID. This prevents finalizing an
         * entry under the wrong supplier.
         */
        if (!matchedEntry) {
          const candidateEntries =
            await prisma.supplierEntry.findMany({
              where: {
                projectId: entryProjectId,
                externalId: entryExternalId,
              },
              select: {
                id: true,
                supplierCode: true,
                finalOutcome: true,
              },
              take: 2,
            });

          if (candidateEntries.length === 1) {
            matchedEntry = candidateEntries[0];
          } else if (candidateEntries.length > 1) {
            console.warn(
              "SupplierEntry finalization skipped because multiple entries matched:",
              {
                pid,
                projectId: entryProjectId,
                externalId: entryExternalId,
                redirectSupplierValue,
                resolvedSupplierCode,
                candidateSupplierCodes: candidateEntries.map(
                  (entry) => entry.supplierCode
                ),
              }
            );
          }
        }

        if (!matchedEntry) {
          console.warn(
            "No SupplierEntry found for finalization:",
            {
              pid,
              projectId: entryProjectId,
              externalId: entryExternalId,
              redirectSupplierValue,
              resolvedSupplierCode,
              finalOutcome: mapped.eventOutcome,
            }
          );
        } else if (matchedEntry.finalOutcome !== null) {
          /*
           * Preserve the first final result if a duplicate callback arrives.
           */
          console.log(
            "SupplierEntry was already finalized; duplicate callback ignored:",
            {
              pid,
              supplierEntryId: matchedEntry.id,
              projectId: entryProjectId,
              supplierCode: matchedEntry.supplierCode,
              externalId: entryExternalId,
              existingFinalOutcome: matchedEntry.finalOutcome,
              receivedFinalOutcome: mapped.eventOutcome,
            }
          );
        } else {
          await prisma.supplierEntry.update({
            where: {
              id: matchedEntry.id,
            },
            data: {
              currentStage: "FINALIZED",
              finalOutcome: mapped.eventOutcome,
              finalOutcomeAt: new Date(),
              finalSource: "SURVEY_CALLBACK",
            },
          });

          console.log(
            "SupplierEntry finalized successfully:",
            {
              pid,
              supplierEntryId: matchedEntry.id,
              projectId: entryProjectId,
              supplierCode: matchedEntry.supplierCode,
              externalId: entryExternalId,
              finalOutcome: mapped.eventOutcome,
            }
          );
        }
      } catch (entryError) {
        /*
         * SupplierEntry tracking failure must not interrupt the existing
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

    /*
     * Supplier callback URLs require the external respondent identifier.
     */
    const supplierIdent =
      externalId || pid || "";

    if (!externalId) {
      console.warn(
        "Supplier callback is missing the external respondent identifier:",
        {
          pid,
          projectId,
          supplierCode: supplierRecord?.code ?? null,
          redirectResult: mapped.redirectResult,
        }
      );
    }

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
