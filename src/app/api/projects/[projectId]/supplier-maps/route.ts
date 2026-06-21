// FILE: src/app/api/projects/[projectId]/supplier-maps/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

/* ----------------------------- helpers ----------------------------- */

const RedirectionType = z.enum([
  "STATIC_REDIRECT",
  "STATIC_POSTBACK",
  "DYNAMIC_REDIRECT",
  "DYNAMIC_POSTBACK",
]);

const BaseSchema = z.object({
  supplierId: z.string().min(1, "supplierId required"),
  supplierQuota: z.coerce.number().int().nonnegative(),
  clickQuota: z.coerce.number().int().nonnegative(),
  cpi: z.coerce.number().nonnegative(),
  redirectionType: RedirectionType,
  allowTraffic: z.coerce.boolean().optional().default(false),
  supplierProjectId: z
    .union([z.string().min(1), z.null()])
    .optional(),
});

const RedirectUrls = z.object({
  completeUrl: z.string().url(),
  terminateUrl: z.string().url(),
  overQuotaUrl: z.string().url(),
  qualityTermUrl: z.string().url(),
  surveyCloseUrl: z.string().url(),
});

const PostBackUrl = z.object({
  postBackUrl: z.string().url(),
});

const CreateSchema = z.discriminatedUnion("redirectionType", [
  BaseSchema.merge(RedirectUrls).extend({
    redirectionType: z.literal("STATIC_REDIRECT"),
  }),
  BaseSchema.merge(RedirectUrls).extend({
    redirectionType: z.literal("DYNAMIC_REDIRECT"),
  }),
  BaseSchema.merge(PostBackUrl).extend({
    redirectionType: z.literal("STATIC_POSTBACK"),
  }),
  BaseSchema.merge(PostBackUrl).extend({
    redirectionType: z.literal("DYNAMIC_POSTBACK"),
  }),
]);

function badJSON(msg: string, code = 400) {
  return NextResponse.json(
    {
      error: msg,
    },
    {
      status: code,
    }
  );
}

async function resolveProjectId(projectKey: string) {
  const prisma = getPrisma();

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectKey }, { code: projectKey }],
    },
    select: {
      id: true,
    },
  });

  return project?.id ?? null;
}

/**
 * Build a stable lookup key for matching SupplierEntry and
 * SentryRespondentResult records.
 */
function buildEntryKey(
  supplierCode: string,
  externalId: string
) {
  return `${supplierCode}\u0000${externalId}`;
}

/**
 * Build the Supplier Mapping URL that OP Panel will show
 * and persist in the database.
 */
function buildSupplierUrl(opts: {
  uiBase: string;
  projectCode: string;
  supplierCode: string;
}) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");

  const projectCode = encodeURIComponent(
    opts.projectCode || ""
  );

  const supplierCode = encodeURIComponent(
    opts.supplierCode || ""
  );

  return `${ui}/Survey?projectId=${projectCode}&supplierId=${supplierCode}&id=[identifier]`;
}

/* ---------------------------------- GET ---------------------------------- */

/**
 * List supplier mappings with flattened supplier details and counts.
 *
 * SupplierEntry is the single source of truth for:
 *
 * - Entrants
 * - In Progress
 * - Finalized / Total
 * - Complete
 * - Terminate
 * - OverQuota
 * - DropOut
 * - QualityTerm
 * - Survey Close
 *
 * Sentry and Verisoul results are counted only when a matching
 * SupplierEntry exists for the same project, supplier and external ID.
 */
export async function GET(
  _req: Request,
  ctx: {
    params: Promise<{
      projectId: string;
    }>;
  }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } = await ctx.params;

  const projId = await resolveProjectId(projectKey);

  if (!projId) {
    return badJSON("Project not found", 404);
  }

  const maps = await prisma.projectSupplierMap.findMany({
    where: {
      projectId: projId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
          countryCode: true,
          contactNumber: true,
          email: true,
          website: true,
        },
      },
    },
  });

  /*
   * All lifecycle counts now come from SupplierEntry.
   */
  type EntrySupplierCounts = {
    entrants: number;
    inProgress: number;
    finalized: number;
    complete: number;
    terminate: number;
    overQuota: number;
    dropOut: number;
    qualityTerm: number;
    surveyClose: number;
  };

  const emptyEntryCounts = (): EntrySupplierCounts => ({
    entrants: 0,
    inProgress: 0,
    finalized: 0,
    complete: 0,
    terminate: 0,
    overQuota: 0,
    dropOut: 0,
    qualityTerm: 0,
    surveyClose: 0,
  });

  let entryBySupplier: Record<
    string,
    EntrySupplierCounts
  > = {};

  /*
   * These keys are also used to exclude direct/manual
   * Sentry callback tests that never had a SupplierEntry.
   */
  const trackedEntryKeys = new Set<string>();

  try {
    const entryRows =
      await prisma.supplierEntry.findMany({
        where: {
          projectId: projId,
          supplierCode: {
            not: "",
          },
        },
        select: {
          supplierCode: true,
          externalId: true,
          finalOutcome: true,
        },
      });

    for (const row of entryRows) {
      const supplierCode = String(
        row.supplierCode || ""
      ).trim();

      const externalId = String(
        row.externalId || ""
      );

      if (!supplierCode || !externalId) {
        continue;
      }

      trackedEntryKeys.add(
        buildEntryKey(supplierCode, externalId)
      );

      entryBySupplier[supplierCode] ??=
        emptyEntryCounts();

      const counts =
        entryBySupplier[supplierCode];

      /*
       * SupplierEntry has a unique constraint on:
       *
       * projectId + supplierCode + externalId
       *
       * Therefore, every row represents one unique entrant.
       */
      counts.entrants += 1;

      if (row.finalOutcome === null) {
        counts.inProgress += 1;
        continue;
      }

      counts.finalized += 1;

      const finalOutcome = String(
        row.finalOutcome
      ).toUpperCase();

      switch (finalOutcome) {
        case "COMPLETE":
          counts.complete += 1;
          break;

        case "TERMINATE":
          counts.terminate += 1;
          break;

        case "OVER_QUOTA":
          counts.overQuota += 1;
          break;

        case "DROP_OUT":
          counts.dropOut += 1;
          break;

        case "QUALITY_TERM":
          counts.qualityTerm += 1;
          break;

        case "SURVEY_CLOSE":
          counts.surveyClose += 1;
          break;

        default:
          console.warn(
            "Unknown SupplierEntry finalOutcome:",
            {
              projectId: projId,
              supplierCode,
              externalId,
              finalOutcome,
            }
          );
          break;
      }
    }
  } catch (error) {
    console.error(
      "Failed to aggregate SupplierEntry counts:",
      error
    );
  }

  /*
   * Sentry and Verisoul counts.
   *
   * Only include provider results that have a matching
   * SupplierEntry. This excludes direct/manual callback tests.
   */
  type SentrySupplierCounts = {
    sentryPass: number;
    sentryFail: number;
    verisoulPass: number;
    verisoulFail: number;
  };

  type SentrySupplierSets = {
    sentryPass: Set<string>;
    sentryFail: Set<string>;
    verisoulPass: Set<string>;
    verisoulFail: Set<string>;
  };

  let sentryBySupplier: Record<
    string,
    SentrySupplierCounts
  > = {};

  try {
    const sentryRows =
      await prisma.sentryRespondentResult.findMany({
        where: {
          projectId: projId,
          supplierCode: {
            not: "",
          },
        },
        select: {
          supplierCode: true,
          externalId: true,
          sentryResult: true,
          verisoulResult: true,
        },
      });

    const sentrySetsBySupplier: Record<
      string,
      SentrySupplierSets
    > = {};

    for (const row of sentryRows) {
      const supplierCode = String(
        row.supplierCode || ""
      ).trim();

      const externalId = String(
        row.externalId || ""
      );

      if (!supplierCode || !externalId) {
        continue;
      }

      const entryKey = buildEntryKey(
        supplierCode,
        externalId
      );

      /*
       * Exclude Sentry/Verisoul records that did not enter
       * through a tracked supplier entry.
       */
      if (!trackedEntryKeys.has(entryKey)) {
        continue;
      }

      sentrySetsBySupplier[supplierCode] ??= {
        sentryPass: new Set<string>(),
        sentryFail: new Set<string>(),
        verisoulPass: new Set<string>(),
        verisoulFail: new Set<string>(),
      };

      const sets =
        sentrySetsBySupplier[supplierCode];

      const sentryResult = String(
        row.sentryResult || ""
      )
        .trim()
        .toUpperCase();

      const verisoulResult = String(
        row.verisoulResult || ""
      )
        .trim()
        .toUpperCase();

      /*
       * Count one Sentry result per external ID.
       */
      if (sentryResult === "PASS") {
        sets.sentryPass.add(externalId);
      } else if (
        sentryResult.startsWith("FAIL")
      ) {
        sets.sentryFail.add(externalId);
      }

      /*
       * Verisoul may return PASS, FAIL, FAKE,
       * SUSPICIOUS or another non-pass fraud result.
       */
      if (verisoulResult === "PASS") {
        sets.verisoulPass.add(externalId);
      } else if (verisoulResult) {
        sets.verisoulFail.add(externalId);
      }
    }

    sentryBySupplier = Object.entries(
      sentrySetsBySupplier
    ).reduce(
      (acc, [supplierCode, sets]) => {
        acc[supplierCode] = {
          sentryPass: sets.sentryPass.size,
          sentryFail: sets.sentryFail.size,
          verisoulPass:
            sets.verisoulPass.size,
          verisoulFail:
            sets.verisoulFail.size,
        };

        return acc;
      },
      {} as Record<
        string,
        SentrySupplierCounts
      >
    );
  } catch (error) {
    console.error(
      "Failed to aggregate tracked Sentry counts:",
      error
    );
  }

  const items = maps.map((mapping) => {
    const supplierCode =
      mapping.supplier?.code ?? "";

    const entryCounts =
      entryBySupplier[supplierCode] ??
      emptyEntryCounts();

    const sentryCounts =
      sentryBySupplier[supplierCode] ?? {
        sentryPass: 0,
        sentryFail: 0,
        verisoulPass: 0,
        verisoulFail: 0,
      };

    return {
      id: mapping.id,
      projectId: mapping.projectId,
      supplierId: mapping.supplierId,

      supplierCode,
      supplierName:
        mapping.supplier?.name ?? "",
      supplierCountry:
        mapping.supplier?.countryCode ?? "",
      contactNumber:
        mapping.supplier?.contactNumber ?? "",
      email: mapping.supplier?.email ?? "",
      website:
        mapping.supplier?.website ?? "",

      supplierQuota: mapping.quota,
      clickQuota: mapping.clickQuota,
      cpi: mapping.cpi?.toString(),

      redirectionType:
        mapping.redirectionType,
      postBackUrl: mapping.postBackUrl,
      completeUrl: mapping.completeUrl,
      terminateUrl: mapping.terminateUrl,
      overQuotaUrl: mapping.overQuotaUrl,
      qualityTermUrl:
        mapping.qualityTermUrl,
      surveyCloseUrl:
        mapping.surveyCloseUrl,

      allowTraffic: mapping.allowTraffic,
      supplierProjectId:
        mapping.supplierProjectId,

      supplierUrl:
        (mapping as any).supplierUrl ?? null,

      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,

      /*
       * SupplierEntry lifecycle counts.
       */
      entrants: entryCounts.entrants,
      inProgress: entryCounts.inProgress,

      /*
       * New explicit name.
       */
      finalized: entryCounts.finalized,

      /*
       * Backward-compatible field for the existing UI.
       *
       * Total now means every SupplierEntry that has
       * a non-null finalOutcome.
       */
      total: entryCounts.finalized,

      complete: entryCounts.complete,
      terminate: entryCounts.terminate,
      overQuota: entryCounts.overQuota,
      qualityTerm: entryCounts.qualityTerm,

      /*
       * The business-facing Drop Out column combines:
       * - legacy DROP_OUT outcomes
       * - current SURVEY_CLOSE callbacks (auth=sc / auth=70)
       */
      dropOut:
        entryCounts.dropOut +
        entryCounts.surveyClose,

      /*
       * Keep the raw Survey Close value in the API for
       * diagnostics and backward compatibility.
       * The Supplier Mapped UI does not display it separately.
       */
      surveyClose: entryCounts.surveyClose,

      /*
       * Provider-security counts restricted to
       * respondents having a matching SupplierEntry.
       */
      sentryPass: sentryCounts.sentryPass,
      sentryFail: sentryCounts.sentryFail,
      verisoulPass:
        sentryCounts.verisoulPass,
      verisoulFail:
        sentryCounts.verisoulFail,
    };
  });

  return NextResponse.json({
    items,
  });
}

/* ---------------------------------- POST --------------------------------- */

export async function POST(
  req: Request,
  ctx: {
    params: Promise<{
      projectId: string;
    }>;
  }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } =
    await ctx.params;

  try {
    const projId =
      await resolveProjectId(projectKey);

    if (!projId) {
      return badJSON(
        "Project not found",
        404
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return badJSON(
        "Invalid JSON",
        400
      );
    }

    const parsed =
      CreateSchema.safeParse(body);

    if (!parsed.success) {
      const flat =
        parsed.error.flatten();

      const message =
        flat.formErrors.join("; ") ||
        Object.values(
          flat.fieldErrors
        )
          .flat()
          .join("; ") ||
        "Invalid payload";

      return badJSON(message, 400);
    }

    const data = parsed.data;

    const supplier =
      await prisma.supplier.findUnique({
        where: {
          id: data.supplierId,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (!supplier) {
      return badJSON(
        "Supplier not found",
        404
      );
    }

    const project =
      await prisma.project.findUnique({
        where: {
          id: projId,
        },
        select: {
          code: true,
        },
      });

    const projectCode = String(
      project?.code ?? ""
    );

    if (!projectCode) {
      return badJSON(
        "Project code missing",
        400
      );
    }

    const uiBase =
      (
        process.env.APP_PUBLIC_BASE_URL ||
        ""
      ).trim() ||
      (
        process.env.NEXT_PUBLIC_UI_ORIGIN ||
        ""
      ).trim() ||
      "https://opinion-elite.com";

    const supplierUrl =
      buildSupplierUrl({
        uiBase,
        projectCode,
        supplierCode: String(
          supplier.code ?? ""
        ),
      });

    const createData: any = {
      projectId: projId,
      supplierId: data.supplierId,
      quota: data.supplierQuota,
      clickQuota: data.clickQuota,
      cpi: data.cpi,
      redirectionType:
        data.redirectionType,
      allowTraffic:
        data.allowTraffic ?? false,
      supplierProjectId:
        data.supplierProjectId ?? null,
      supplierUrl,
    };

    if (
      data.redirectionType ===
        "STATIC_REDIRECT" ||
      data.redirectionType ===
        "DYNAMIC_REDIRECT"
    ) {
      createData.completeUrl = (
        data as any
      ).completeUrl;

      createData.terminateUrl = (
        data as any
      ).terminateUrl;

      createData.overQuotaUrl = (
        data as any
      ).overQuotaUrl;

      createData.qualityTermUrl = (
        data as any
      ).qualityTermUrl;

      createData.surveyCloseUrl = (
        data as any
      ).surveyCloseUrl;
    } else {
      createData.postBackUrl = (
        data as any
      ).postBackUrl;
    }

    const created =
      await prisma.projectSupplierMap.create({
        data: createData,
      });

    return NextResponse.json(
      {
        item: {
          id: created.id,
          projectId: created.projectId,
          supplierId:
            created.supplierId,

          supplierCode:
            supplier.code ?? "",
          supplierName:
            supplier.name ?? "",

          supplierQuota:
            created.quota,
          clickQuota:
            created.clickQuota,
          cpi:
            created.cpi?.toString(),

          redirectionType:
            created.redirectionType,
          postBackUrl:
            created.postBackUrl,

          completeUrl:
            created.completeUrl,
          terminateUrl:
            created.terminateUrl,
          overQuotaUrl:
            created.overQuotaUrl,
          qualityTermUrl:
            created.qualityTermUrl,
          surveyCloseUrl:
            created.surveyCloseUrl,

          allowTraffic:
            created.allowTraffic,
          supplierProjectId:
            created.supplierProjectId,

          supplierUrl:
            (created as any)
              .supplierUrl ??
            supplierUrl,

          createdAt:
            created.createdAt,
          updatedAt:
            created.updatedAt,

          entrants: 0,
          inProgress: 0,
          finalized: 0,

          /*
           * Retained for compatibility with the
           * current SupplierMappedSummary UI.
           */
          total: 0,

          complete: 0,
          terminate: 0,
          overQuota: 0,
          dropOut: 0,
          qualityTerm: 0,
          surveyClose: 0,

          sentryPass: 0,
          sentryFail: 0,
          verisoulPass: 0,
          verisoulFail: 0,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    const message = String(
      error?.message || error
    );

    const hint = message.includes(
      "Transactions are not supported"
    )
      ? " Prisma HTTP/Data Proxy on Cloudflare does not support $transaction or nested writes. This route uses only simple single-table reads/writes."
      : "";

    return NextResponse.json(
      {
        error:
          "Failed to create supplier map",
        detail: message + hint,
      },
      {
        status: 400,
      }
    );
  }
}