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
 * Entrants:
 * Unique SupplierEntry rows for the project and supplier.
 *
 * In Progress:
 * SupplierEntry rows where finalOutcome is still null.
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
   * Existing final outcome counts.
   *
   * SupplierRedirectEvent.supplierId stores the Supplier database ID.
   */
  let bySupplier: Record<
    string,
    Record<string, number>
  > = {};

  try {
    const outcomeAggregation =
      await prisma.supplierRedirectEvent.groupBy({
        by: ["supplierId", "outcome"],
        where: {
          projectId: projId,
          supplierId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      });

    bySupplier = outcomeAggregation.reduce(
      (acc, row) => {
        if (!row.supplierId || !row.outcome) {
          return acc;
        }

        const supplierDbId = row.supplierId;

        acc[supplierDbId] ??= {};

        const key =
          row.outcome === "COMPLETE"
            ? "COMPLETE"
            : row.outcome === "TERMINATE"
              ? "TERMINATE"
              : row.outcome === "OVER_QUOTA"
                ? "OVERQUOTA"
                : row.outcome === "DROP_OUT"
                  ? "DROPOUT"
                  : row.outcome === "QUALITY_TERM"
                    ? "QUALITYTERM"
                    : row.outcome === "SURVEY_CLOSE"
                      ? "CLOSE"
                      : String(row.outcome);

        acc[supplierDbId][key] =
          row._count._all;

        return acc;
      },
      {} as Record<
        string,
        Record<string, number>
      >
    );
  } catch (error) {
    console.error(
      "Failed to aggregate supplier outcome counts:",
      error
    );
  }

  /*
   * Entrant and In Progress counts.
   *
   * SupplierEntry.supplierCode stores values such as S1007.
   */
  type EntrySupplierCounts = {
    entrants: number;
    inProgress: number;
  };

  let entryBySupplier: Record<
    string,
    EntrySupplierCounts
  > = {};

  try {
    const entryAggregation =
      await prisma.supplierEntry.groupBy({
        by: ["supplierCode", "finalOutcome"],
        where: {
          projectId: projId,
          supplierCode: {
            not: "",
          },
        },
        _count: {
          _all: true,
        },
      });

    entryBySupplier = entryAggregation.reduce(
      (acc, row) => {
        const supplierCode = String(
          row.supplierCode || ""
        ).trim();

        if (!supplierCode) {
          return acc;
        }

        acc[supplierCode] ??= {
          entrants: 0,
          inProgress: 0,
        };

        const count = row._count._all;

        /*
         * Every SupplierEntry row represents one unique entrant
         * because the table has a unique key on:
         *
         * projectId + supplierCode + externalId.
         */
        acc[supplierCode].entrants += count;

        if (row.finalOutcome === null) {
          acc[supplierCode].inProgress += count;
        }

        return acc;
      },
      {} as Record<
        string,
        EntrySupplierCounts
      >
    );
  } catch (error) {
    console.error(
      "Failed to aggregate SupplierEntry counts:",
      error
    );
  }

  /*
   * Existing Sentry and Verisoul counts.
   */
  type SentrySupplierCounts = {
    sentryPass: number;
    sentryFail: number;
    verisoulPass: number;
    verisoulFail: number;
  };

  let sentryBySupplier: Record<
    string,
    SentrySupplierCounts
  > = {};

  try {
    const sentryAggregation =
      await prisma.sentryRespondentResult.groupBy({
        by: [
          "supplierCode",
          "sentryResult",
          "verisoulResult",
        ],
        where: {
          projectId: projId,
          supplierCode: {
            not: "",
          },
        },
        _count: {
          _all: true,
        },
      });

    sentryBySupplier =
      sentryAggregation.reduce(
        (acc, row) => {
          const supplierCode = String(
            row.supplierCode || ""
          ).trim();

          if (!supplierCode) {
            return acc;
          }

          acc[supplierCode] ??= {
            sentryPass: 0,
            sentryFail: 0,
            verisoulPass: 0,
            verisoulFail: 0,
          };

          const count = row._count._all;

          const sentryResult = String(
            row.sentryResult || ""
          ).toUpperCase();

          const verisoulResult = String(
            row.verisoulResult || ""
          ).toUpperCase();

          if (sentryResult === "PASS") {
            acc[supplierCode].sentryPass +=
              count;
          } else {
            acc[supplierCode].sentryFail +=
              count;
          }

          /*
           * Only count Verisoul when a separate result
           * value is available.
           */
          if (verisoulResult) {
            if (verisoulResult === "PASS") {
              acc[
                supplierCode
              ].verisoulPass += count;
            } else {
              acc[
                supplierCode
              ].verisoulFail += count;
            }
          }

          return acc;
        },
        {} as Record<
          string,
          SentrySupplierCounts
        >
      );
  } catch (error) {
    console.error(
      "Failed to aggregate Sentry counts:",
      error
    );
  }

  const items = maps.map((mapping) => {
    const supplierCode =
      mapping.supplier?.code ?? "";

    const outcomeCounts =
      bySupplier[mapping.supplierId] ?? {};

    const entryCounts =
      entryBySupplier[supplierCode] ?? {
        entrants: 0,
        inProgress: 0,
      };

    const sentryCounts =
      sentryBySupplier[supplierCode] ?? {
        sentryPass: 0,
        sentryFail: 0,
        verisoulPass: 0,
        verisoulFail: 0,
      };

    const complete =
      outcomeCounts.COMPLETE ?? 0;

    const terminate =
      outcomeCounts.TERMINATE ?? 0;

    const overQuota =
      outcomeCounts.OVERQUOTA ?? 0;

    const dropOut =
      outcomeCounts.DROPOUT ?? 0;

    const qualityTerm =
      outcomeCounts.QUALITYTERM ?? 0;

    const close =
      outcomeCounts.CLOSE ?? 0;

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
       * New SupplierEntry-based counts.
       */
      entrants: entryCounts.entrants,
      inProgress: entryCounts.inProgress,

      /*
       * Existing final-outcome total remains unchanged.
       */
      total:
        complete +
        terminate +
        overQuota +
        qualityTerm +
        close,

      complete,
      terminate,
      overQuota,
      dropOut,
      qualityTerm,

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

          total: 0,
          complete: 0,
          terminate: 0,
          overQuota: 0,
          dropOut: 0,
          qualityTerm: 0,

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