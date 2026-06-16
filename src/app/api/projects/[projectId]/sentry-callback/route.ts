export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

function buildTerminateUrl(origin: string) {
  return new URL("/Thanks?status=TERMINATE", origin);
}

function normalizeSentryResult(status: string) {
  if (status === "1") return "PASS";
  if (status === "2") return "FAIL_BEHAVIORAL";
  if (status === "3") return "FAIL_TECH_SECURITY";

  return "UNKNOWN";
}

function cleanParamValue(value: string | null) {
  const v = (value || "").trim();

  if (!v) return null;

  // If CloudResearch has not replaced the reserved variable for any reason,
  // do not store the literal placeholder as a real value.
  if (v.startsWith("SENTRY_")) return null;

  return v;
}

function getFirstParam(url: URL, keys: string[]) {
  for (const key of keys) {
    const value = cleanParamValue(url.searchParams.get(key));

    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeVerisoulResult(value: string | null) {
  const v = cleanParamValue(value);

  if (!v) return null;

  // SENTRY_VERISOUL_DECISION values:
  // 0 = Real
  // 1 = Suspicious
  // 2 = Fake
  if (v === "0") return "PASS";
  if (v === "1") return "FAIL_SUSPICIOUS";
  if (v === "2") return "FAIL_FAKE";

  const normalized = v.toUpperCase();

  if (normalized === "REAL") return "PASS";
  if (normalized === "SUSPICIOUS") return "FAIL_SUSPICIOUS";
  if (normalized === "FAKE") return "FAIL_FAKE";

  return normalized;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const statusRaw =
    url.searchParams.get("sentry_status") ||
    url.searchParams.get("status") ||
    url.searchParams.get("result") ||
    "";

  const status = statusRaw.trim().toLowerCase();

  const supplierId = (url.searchParams.get("supplierId") || "").trim();

  // Sentry provider config uses idField=aid.
  // Keep fallback to id also, in case older URLs still return id.
  const externalId = (
    url.searchParams.get("aid") ||
    url.searchParams.get("id") ||
    ""
  ).trim();

  const birthDate = (url.searchParams.get("birthDate") || "").trim();
  const gender = (url.searchParams.get("gender") || "").trim();

  if (!projectId || !externalId) {
    return NextResponse.redirect(buildTerminateUrl(url.origin), 302);
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectId }, { code: projectId }],
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!project) {
    return NextResponse.redirect(buildTerminateUrl(url.origin), 302);
  }

  const projectKey = project.code || project.id;

  const sentryResult = normalizeSentryResult(status);
  const supplierCode = supplierId || "";

  const verisoulDecision = getFirstParam(url, [
    "verisoul_decision",
    "verisoul_status",
    "verisoulStatus",
  ]);

  const verisoulResult = normalizeVerisoulResult(
    getFirstParam(url, [
      "verisoul_decision",
      "verisoul_result",
      "verisoulResult",
    ])
  );

  /*
   * Finalize the matching SupplierEntry when Sentry terminates the respondent.
   *
   * This removes the respondent from the In Progress count.
   * The finalOutcome:null condition preserves the first final result if
   * CloudResearch sends the callback more than once.
   *
   * Tracking failures must never block the respondent routing flow.
   */
  const finalizeSupplierEntryAsTerminate = async (
    callbackReason: string
  ): Promise<void> => {
    if (!supplierCode || !externalId) {
      console.warn(
        `SupplierEntry was not finalized for ${callbackReason}: missing supplierCode or externalId`,
        {
          projectId: project.id,
          supplierCode,
          externalId,
        }
      );

      return;
    }

    try {
      const result = await prisma.supplierEntry.updateMany({
        where: {
          projectId: project.id,
          supplierCode,
          externalId,
          finalOutcome: null,
        },
        data: {
          currentStage: "FINALIZED",
          finalOutcome: "TERMINATE",
          finalOutcomeAt: new Date(),
        },
      });

      if (result.count === 0) {
        console.warn(
          `No unfinished SupplierEntry found for ${callbackReason}`,
          {
            projectId: project.id,
            projectCode: project.code,
            supplierCode,
            externalId,
            sentryStatus: status || "UNKNOWN",
          }
        );
      }
    } catch (entryError) {
      console.error(
        `Failed to finalize SupplierEntry for ${callbackReason}:`,
        entryError
      );
    }
  };

  try {
    await prisma.sentryRespondentResult.upsert({
      where: {
        projectId_supplierCode_externalId: {
          projectId: project.id,
          supplierCode,
          externalId,
        },
      },
      create: {
        projectId: project.id,
        projectCode: project.code,
        supplierCode,
        externalId,

        sentryStatus: status || "UNKNOWN",
        sentryResult,

        providerId: url.searchParams.get("providerId"),
        language: url.searchParams.get("language"),
        rawQuery: url.searchParams.toString(),

        // Verisoul variable replacement fields from CloudResearch.
        // verisoul_decision:
        // 0 = Real
        // 1 = Suspicious
        // 2 = Fake
        verisoulStatus: verisoulDecision,
        verisoulResult,
      },
      update: {
        projectCode: project.code,

        sentryStatus: status || "UNKNOWN",
        sentryResult,

        providerId: url.searchParams.get("providerId"),
        language: url.searchParams.get("language"),
        rawQuery: url.searchParams.toString(),

        // Verisoul variable replacement fields from CloudResearch.
        // verisoul_decision:
        // 0 = Real
        // 1 = Suspicious
        // 2 = Fake
        verisoulStatus: verisoulDecision,
        verisoulResult,
      },
    });
  } catch (err) {
    // Result tracking must not interrupt respondent routing.
    console.error("Failed to store Sentry respondent result:", err);
  }

  // Sentry docs:
  // 1 = Pass
  // 2 = Fail - Behavioral Interview
  // 3 = Fail - Tech Security Blocked
  const isPass = status === "1";
  const isFail = status === "2" || status === "3";

  if (isFail) {
    // A failed Sentry result is a final termination for this respondent.
    await finalizeSupplierEntryAsTerminate(`Sentry failure status ${status}`);

    const terminateUrl = buildTerminateUrl(url.origin);

    terminateUrl.searchParams.set("projectId", projectKey);
    terminateUrl.searchParams.set("id", externalId);

    if (supplierId) {
      terminateUrl.searchParams.set("supplierId", supplierId);
    }

    terminateUrl.searchParams.set("fromSentry", "1");
    terminateUrl.searchParams.set("sentry_status", status);

    return NextResponse.redirect(terminateUrl.toString(), 302);
  }

  if (isPass) {
    const launchUrl = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/launch`,
      url.origin
    );

    launchUrl.searchParams.set("id", externalId);

    if (supplierId) {
      launchUrl.searchParams.set("supplierId", supplierId);
    }

    if (birthDate) {
      launchUrl.searchParams.set("birthDate", birthDate);
    }

    if (gender) {
      launchUrl.searchParams.set("gender", gender);
    }

    // Preserve routing state so the launch route does not send the user
    // back to Prescreen or Sentry.
    launchUrl.searchParams.set("fromPrescreen", "1");
    launchUrl.searchParams.set("fromSentry", "1");
    launchUrl.searchParams.set("sentryDone", "1");
    launchUrl.searchParams.set("sentry_status", status);

    return NextResponse.redirect(launchUrl.toString(), 302);
  }

  /*
   * Missing or unknown sentry_status must not launch the survey.
   * Because the respondent is being terminated, finalize SupplierEntry
   * with TERMINATE before redirecting to the Thanks page.
   */
  await finalizeSupplierEntryAsTerminate(
    status
      ? `unknown Sentry status ${status}`
      : "missing Sentry status"
  );

  const fallbackUrl = buildTerminateUrl(url.origin);

  fallbackUrl.searchParams.set("projectId", projectKey);
  fallbackUrl.searchParams.set("id", externalId);
  fallbackUrl.searchParams.set("fromSentry", "1");

  if (supplierId) {
    fallbackUrl.searchParams.set("supplierId", supplierId);
  }

  if (status) {
    fallbackUrl.searchParams.set("sentry_status", status);
  }

  return NextResponse.redirect(fallbackUrl.toString(), 302);
}