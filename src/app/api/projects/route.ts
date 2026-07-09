// File: src/app/api/projects/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";
import {
  createSentryProject,
  buildSentryPayload,
} from "@/lib/integrations/sentry";

/* ----------------------------- helpers ----------------------------- */

const pageInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const normalizeStatus = (s: string | null): ProjectStatus | undefined => {
  if (!s) return undefined;
  const up = s.toUpperCase() as ProjectStatus;
  return (Object.values(ProjectStatus) as string[]).includes(up)
    ? up
    : undefined;
};

function buildSupplierUrl(opts: {
  uiBase: string;
  projectCode: string;
  supplierCode: string;
  projectType : string;
}) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  const p = encodeURIComponent(opts.projectCode || "");
  const s = encodeURIComponent(opts.supplierCode || "");

  // GET PROJECT TYPE AND REMOVE ANY LEADING/TRAILING SPACES
  const projectType = (opts.projectType || "").trim();

  // GENERATE THE BASE SUPPLIER MAPPING URL
  let url = `${ui}/Survey?projectId=${p}&supplierId=${s}&id=[identifier]`;

  // FOR RECONTACT PROJECTS, APPEND RECID PARAMETER TO THE URL
  if(projectType === "Recontact")
  {
    url += "&recid=[recid]";
  }

  // RETURN THE GENERATED SUPPLIER URL
  return url;
}

function buildInternalThanksUrl(opts: {
  uiBase: string;
  auth: "10" | "20" | "40" | "30" | "70";
}) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  return `${ui}/Thanks/Index?auth=${encodeURIComponent(
    opts.auth
  )}&rid=[identifier]`;
}

async function ensureTestSupplierMapping(args: {
  projectId: string;
  projectCode: string;
  projectType : string;
  supplierQuota: number;
  clickQuota: number;
  cpi: Prisma.Decimal;
}) {
  const prisma = getPrisma();

  const testSupplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        {
          name: {
            equals: "Test Supplier",
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          code: {
            equals: "TEST_SUPPLIER",
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          code: {
            equals: "TEST",
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (!testSupplier) {
    return {
      ok: false as const,
      reason:
        'Test Supplier record not found. Create a Supplier named "Test Supplier" or code "TEST_SUPPLIER".',
    };
  }

  const existing = await prisma.projectSupplierMap.findFirst({
    where: {
      projectId: args.projectId,
      supplierId: testSupplier.id,
    },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: true as const,
      created: false as const,
      supplierId: testSupplier.id,
      supplierCode: testSupplier.code,
    };
  }

  const uiBase =
    (process.env.APP_PUBLIC_BASE_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_UI_ORIGIN || "").trim() ||
    "https://opinion-elite.com";

  const supplierUrl = buildSupplierUrl({
    uiBase,
    projectCode: args.projectCode,
    projectType : args.projectType,
    supplierCode: String(testSupplier.code || ""),
  });

  await prisma.projectSupplierMap.create({
    data: {
      projectId: args.projectId,
      supplierId: testSupplier.id,
      quota: args.supplierQuota,
      clickQuota: args.clickQuota,
      cpi: args.cpi,
      redirectionType: "STATIC_REDIRECT",
      allowTraffic: true,
      supplierProjectId: null,
      supplierUrl,
      completeUrl: buildInternalThanksUrl({ uiBase, auth: "10" }),
      terminateUrl: buildInternalThanksUrl({ uiBase, auth: "20" }),
      overQuotaUrl: buildInternalThanksUrl({ uiBase, auth: "40" }),
      qualityTermUrl: buildInternalThanksUrl({ uiBase, auth: "30" }),
      surveyCloseUrl: buildInternalThanksUrl({ uiBase, auth: "70" }),
    },
  });

  return {
    ok: true as const,
    created: true as const,
    supplierId: testSupplier.id,
    supplierCode: testSupplier.code,
    supplierUrl,
  };
}

/* ------------------------------- GET ------------------------------- */
// GET /api/projects?q=&status=&clientId=&groupId=&page=&pageSize=
export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") ?? "").trim();
  const status = normalizeStatus(searchParams.get("status"));
  const clientId = searchParams.get("clientId");
  const groupId = searchParams.get("groupId");
  const page = pageInt(searchParams.get("page"), 1);
  const pageSize = pageInt(searchParams.get("pageSize"), 10);

  const where: Prisma.ProjectWhereInput = {
    // Exclude API-created projects from normal Project List
    apiSurveySelection: {
      is: null,
    },

    ...(q
      ? {
          OR: [
            {
              code: {
                contains: q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              name: {
                contains: q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              managerEmail: {
                contains: q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),

    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const [itemsRaw, total, grouped] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { client: { select: { name: true } } },
    }),

    prisma.project.count({ where }),

    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
      where,
    }),
  ]);

  const projectIds = itemsRaw.map((project) => project.id);

  type ProjectLifecycleCounts = {
    entrants: number;
    inProgress: number;
    c: number;
    t: number;
    q: number;
    d: number;
  };

  const emptyLifecycleCounts =
    (): ProjectLifecycleCounts => ({
      entrants: 0,
      inProgress: 0,
      c: 0,
      t: 0,
      q: 0,
      d: 0,
    });

  const byProject: Record<
    string,
    ProjectLifecycleCounts
  > = {};

  /*
   * SupplierEntry is the single source of truth for
   * project lifecycle counts.
   *
   * One grouped query is used for all projects on the
   * current page, avoiding one query per project.
   */
  if (projectIds.length > 0) {
    const entryGroups =
      await prisma.supplierEntry.groupBy({
        by: [
          "projectId",
          "finalOutcome",
        ],
        where: {
          projectId: {
            in: projectIds,
          },
        },
        _count: {
          _all: true,
        },
      });

    for (const group of entryGroups) {
      const bucket =
        (byProject[group.projectId] ??=
          emptyLifecycleCounts());

      const count = group._count._all;

      /*
       * Every SupplierEntry represents one unique
       * project/supplier/respondent entrant.
       */
      bucket.entrants += count;

      if (group.finalOutcome === null) {
        bucket.inProgress += count;
        continue;
      }

      const finalOutcome = String(
        group.finalOutcome
      ).toUpperCase();

      switch (finalOutcome) {
        case "COMPLETE":
          bucket.c += count;
          break;

        case "TERMINATE":
          bucket.t += count;
          break;

        case "OVER_QUOTA":
        case "OVERQUOTA":
          bucket.q += count;
          break;

        /*
         * Survey Close is displayed operationally
         * as Drop Out.
         */
        case "DROP_OUT":
        case "SURVEY_CLOSE":
          bucket.d += count;
          break;

        /*
         * QUALITY_TERM remains a separate outcome,
         * but the current Project List does not have
         * a Quality Term column.
         */
        case "QUALITY_TERM":
          break;

        default:
          console.warn(
            "Unknown SupplierEntry final outcome in project list:",
            {
              projectId: group.projectId,
              finalOutcome,
            }
          );
          break;
      }
    }
  }

  const items = itemsRaw.map(
    ({ client, ...rest }) => {
      const lifecycle =
        byProject[rest.id] ??
        emptyLifecycleCounts();

      return {
        ...rest,

        clientName:
          client?.name ?? null,

        entrants:
          lifecycle.entrants,

        inProgress:
          lifecycle.inProgress,

        c: lifecycle.c,
        t: lifecycle.t,
        q: lifecycle.q,
        d: lifecycle.d,
      };
    }
  );

  const statusCounts = Object.values(ProjectStatus).reduce<
    Record<ProjectStatus, number>
  >((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as Record<ProjectStatus, number>);

  for (const g of grouped) {
    statusCounts[g.status as ProjectStatus] = g._count._all;
  }

  return NextResponse.json({ items, total, statusCounts });
}

/* ------------------------------- POST ------------------------------ */
// Create project
export async function POST(req: Request) {
  const prisma = getPrisma();
  const raw = await req.json();

  const { code: _ignore, ...b } = raw;

  const {
    sentryEnabled,
    sentryTemplateId,
    sentryHashingEnabled,
    sentryVerisoulEnabled,
    sentryVerisoulTermFake,
    sentryVerisoulTermSuspicious,
    sentryProviderId,
    sentryIdField,
  } = b;

  const loi = Number(b.loi);
  const ir = Number(b.ir);
  const sampleSize = Number(b.sampleSize);

  if (![loi, ir, sampleSize].every(Number.isFinite)) {
    return NextResponse.json(
      { error: "Invalid LOI, IR, or Sample Size" },
      { status: 400 }
    );
  }

  const clickQuota =
    b.clickQuota === undefined || b.clickQuota === null || b.clickQuota === ""
      ? sampleSize
      : Number(b.clickQuota);

  if (!Number.isFinite(clickQuota)) {
    return NextResponse.json(
      { error: "Invalid Click Quota" },
      { status: 400 }
    );
  }

  if (
    b.projectCpi === undefined ||
    b.projectCpi === null ||
    b.projectCpi === ""
  ) {
    return NextResponse.json(
      { error: "Project CPI is required" },
      { status: 400 }
    );
  }

  const projectCpi = new Prisma.Decimal(b.projectCpi);

  const supplierCpi =
    b.supplierCpi === null ||
    b.supplierCpi === undefined ||
    b.supplierCpi === ""
      ? null
      : new Prisma.Decimal(b.supplierCpi);

  if (!b.startDate || !b.endDate) {
    return NextResponse.json(
      { error: "Start and End dates are required" },
      { status: 400 }
    );
  }

  const startDate = new Date(b.startDate);
  const endDate = new Date(b.endDate);

  if (isNaN(+startDate) || isNaN(+endDate)) {
    return NextResponse.json(
      { error: "Invalid dates" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.project.create({
      data: {
        clientId: b.clientId,
        groupId: b.groupId ?? null,

        name: b.name ?? b.projectName,
        managerEmail: b.manager ?? b.managerEmail,
        category: b.category ?? "",
        projectType: b.projectType === "Recontact" ? "Recontact" : "Adhocs",
        description: b.description ?? null,

        countryCode: b.country ?? b.countryCode,
        languageCode: b.language ?? b.languageCode,
        currency: b.currency ?? "USD",

        loi,
        ir,
        sampleSize,
        clickQuota,

        projectCpi,
        supplierCpi,

        startDate,
        endDate,

        preScreen: !!b.preScreen,
        exclude: !!b.exclude,
        geoLocation: !!b.geoLocation,

        dynamicThanksUrl:
          typeof b.dynamicThanks === "boolean"
            ? b.dynamicThanks
            : !!b.dynamicThanksUrl,

        uniqueIp: !!b.uniqueIp,
        uniqueIpDepth:
          b.uniqueIpDepth === "" ||
          b.uniqueIpDepth === null ||
          b.uniqueIpDepth === undefined
            ? null
            : Number(b.uniqueIpDepth),

        tSign: !!b.tSign,

        speeder: !!b.speeder,
        speederDepth:
          b.speederDepth === "" ||
          b.speederDepth === null ||
          b.speederDepth === undefined
            ? null
            : Number(b.speederDepth),

        mobile: !!b.mobile,
        tablet: !!b.tablet,
        desktop: !!b.desktop,

        sentryEnabled: !!sentryEnabled,
        sentryTemplateId: sentryTemplateId ?? null,

        sentryProviderId:
          sentryProviderId?.trim() ||
          process.env.SENTRY_PROVIDER_ID?.trim() ||
          null,

        sentryIdField:
          sentryIdField?.trim() ||
          process.env.SENTRY_ID_FIELD?.trim() ||
          "aid",

        sentryHashingEnabled: !!sentryHashingEnabled,
        sentryVerisoulEnabled: !!sentryVerisoulEnabled,
        sentryVerisoulTermFake: !!sentryVerisoulTermFake,
        sentryVerisoulTermSuspicious: !!sentryVerisoulTermSuspicious,
      },
      select: {
        id: true,
        code: true,
        name: true,
        projectType : true,

        sampleSize: true,
        clickQuota: true,
        supplierCpi: true,
        projectCpi: true,

        sentryTemplateId: true,
        sentryProviderId: true,
        sentryIdField: true,
        sentryVerisoulEnabled: true,
        sentryVerisoulTermFake: true,
        sentryVerisoulTermSuspicious: true,
      },
    });

    let sentryResponse: any = null;

    if (sentryEnabled) {
      try {
        const payload = buildSentryPayload(created);

        sentryResponse = await createSentryProject(payload);

        const sentryProject = sentryResponse?.project;

        if (!sentryProject) {
          throw new Error("Sentry project missing in response");
        }

        await prisma.project.update({
          where: { id: created.id },
          data: {
            sentryProjectId: sentryProject.projectId,
            sentryLiveUrl: sentryProject.liveUrl,
            sentryTestUrl: sentryProject.testUrl,
            sentryReportingUrl: sentryProject.projectReportingUrl,
            sentryProjectStatus: sentryProject.projectStatus,
          },
        });
      } catch (err: any) {
        console.error("❌ Sentry integration failed");
        console.error(err);

        if (err instanceof Error) {
          console.error("MESSAGE:", err.message);
          console.error("STACK:", err.stack);
        }
      }
    }

    let testSupplierWarning: string | null = null;
    let testSupplierMapping: {
      created: boolean;
      supplierId: string;
      supplierCode: string;
      supplierUrl?: string;
    } | null = null;

    try {
      const ensured = await ensureTestSupplierMapping({
        projectId: created.id,
        projectCode: created.code,
        projectType : created.projectType,
        supplierQuota: created.sampleSize,
        clickQuota: created.clickQuota,
        cpi: created.supplierCpi ?? created.projectCpi,
      });

      if (!ensured.ok) {
        testSupplierWarning = ensured.reason;
      } else {
        testSupplierMapping = {
          created: ensured.created,
          supplierId: ensured.supplierId,
          supplierCode: ensured.supplierCode,
          ...(ensured.created && "supplierUrl" in ensured
            ? { supplierUrl: ensured.supplierUrl }
            : {}),
        };
      }
    } catch (e: any) {
      testSupplierWarning = `Project created, but Test Supplier mapping failed: ${String(
        e?.message ?? e
      )}`;
    }

    return NextResponse.json(
      {
        id: created.id,
        code: created.code,
        testSupplierMapping,
        warning: testSupplierWarning,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Create failed",
        detail: String(e?.message ?? e),
      },
      { status: 400 }
    );
  }
}