export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus, RedirectOutcome } from "@prisma/client";
import { createSentryProject } from "@/lib/integrations/sentry";

/* ----------------------------- helpers ----------------------------- */

const pageInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const normalizeStatus = (s: string | null): ProjectStatus | undefined => {
  if (!s) return undefined;
  const up = s.toUpperCase() as ProjectStatus;
  return (Object.values(ProjectStatus) as string[]).includes(up) ? up : undefined;
};

function buildSupplierUrl(opts: {
  uiBase: string;
  projectCode: string;
  supplierCode: string;
}) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  const p = encodeURIComponent(opts.projectCode || "");
  const s = encodeURIComponent(opts.supplierCode || "");
  return `${ui}/Survey?projectId=${p}&supplierId=${s}&id=[identifier]`;
}

function buildInternalThanksUrl(opts: {
  uiBase: string;
  auth: "10" | "20" | "40" | "30" | "70";
}) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  return `${ui}/Thanks/Index?auth=${encodeURIComponent(opts.auth)}&rid=[identifier]`;
}

async function ensureTestSupplierMapping(args: {
  projectId: string;
  projectCode: string;
  supplierQuota: number;
  clickQuota: number;
  cpi: Prisma.Decimal;
}) {
  const prisma = getPrisma();

  const testSupplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: "Test Supplier", mode: Prisma.QueryMode.insensitive } },
        { code: { equals: "TEST_SUPPLIER", mode: Prisma.QueryMode.insensitive } },
        { code: { equals: "TEST", mode: Prisma.QueryMode.insensitive } },
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
      reason: 'Test Supplier record not found. Create a Supplier named "Test Supplier" or code "TEST_SUPPLIER".',
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
            { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { managerEmail: { contains: q, mode: Prisma.QueryMode.insensitive } },
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

  const projectIds = itemsRaw.map((p) => p.id);

  let outcomeGrouped: {
    projectId: string;
    outcome: RedirectOutcome;
    _count: { _all: number };
  }[] = [];

  if (projectIds.length > 0) {
    const groupedOutcomes = await prisma.supplierRedirectEvent.groupBy({
      by: ["projectId", "outcome"] as const,
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    outcomeGrouped = groupedOutcomes as typeof outcomeGrouped;
  }

  const byProject: Record<string, { c: number; t: number; q: number; d: number }> = {};
  for (const g of outcomeGrouped) {
    const bucket = (byProject[g.projectId] ??= { c: 0, t: 0, q: 0, d: 0 });
    switch (g.outcome) {
      case "COMPLETE":
        bucket.c += g._count._all;
        break;
      case "TERMINATE":
        bucket.t += g._count._all;
        break;
      case "OVER_QUOTA":
        bucket.q += g._count._all;
        break;
      case "DROP_OUT":
        bucket.d += g._count._all;
        break;
      default:
        break;
    }
  }

  const items = itemsRaw.map(({ client, ...rest }) => {
    const totals = byProject[rest.id] ?? { c: 0, t: 0, q: 0, d: 0 };
    return {
      ...rest,
      clientName: client?.name ?? null,
      c: totals.c,
      t: totals.t,
      q: totals.q,
      d: totals.d,
    };
  });

  const statusCounts = Object.values(ProjectStatus).reduce<Record<ProjectStatus, number>>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );
  for (const g of grouped) statusCounts[g.status as ProjectStatus] = g._count._all;

  return NextResponse.json({ items, total, statusCounts });
}

/* ------------------------------- POST ------------------------------ */
// Create project (server validates numbers/decimals/dates)
export async function POST(req: Request) {
  const prisma = getPrisma();
  const raw = await req.json();

  const { code: _ignore, ...b } = raw;
  const {
  sentryEnabled,
  sentryProjectId,
  sentryTemplateId,
  sentryLiveUrl,
  sentryTestUrl,
  sentryReportingUrl,
  sentryProjectStatus,
  sentryHashingEnabled,
  sentryVerisoulEnabled,
  sentryVerisoulTermFake,
  sentryVerisoulTermSuspicious,
} = b;

  const loi = Number(b.loi);
  const ir = Number(b.ir);
  const sampleSize = Number(b.sampleSize);
  if (![loi, ir, sampleSize].every(Number.isFinite)) {
    return NextResponse.json({ error: "Invalid LOI/IR/Sample Size" }, { status: 400 });
  }

  const clickQuota =
    b.clickQuota === undefined || b.clickQuota === null || b.clickQuota === ""
      ? sampleSize
      : Number(b.clickQuota);
  if (!Number.isFinite(clickQuota)) {
    return NextResponse.json({ error: "Invalid Click Quota" }, { status: 400 });
  }

  if (b.projectCpi === undefined || b.projectCpi === null || b.projectCpi === "") {
    return NextResponse.json({ error: "Project CPI is required" }, { status: 400 });
  }
  const projectCpi = new Prisma.Decimal(b.projectCpi);
  const supplierCpi =
    b.supplierCpi === null || b.supplierCpi === undefined || b.supplierCpi === ""
      ? null
      : new Prisma.Decimal(b.supplierCpi);

  if (!b.startDate || !b.endDate) {
    return NextResponse.json({ error: "Start and End dates are required" }, { status: 400 });
  }
  const startDate = new Date(b.startDate);
  const endDate = new Date(b.endDate);
  if (isNaN(+startDate) || isNaN(+endDate)) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  try {
    const created = await prisma.project.create({
      data: {
        clientId: b.clientId,
        groupId: b.groupId ?? null,

        name: b.name ?? b.projectName,
        managerEmail: b.manager ?? b.managerEmail,
        category: b.category ?? "",
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
          b.uniqueIpDepth === "" || b.uniqueIpDepth === null || b.uniqueIpDepth === undefined
            ? null
            : Number(b.uniqueIpDepth),
        tSign: !!b.tSign,
        speeder: !!b.speeder,
        speederDepth:
          b.speederDepth === "" || b.speederDepth === null || b.speederDepth === undefined
            ? null
            : Number(b.speederDepth),

        mobile: !!b.mobile,
        tablet: !!b.tablet,
        desktop: !!b.desktop,
        sentryEnabled: sentryEnabled ?? false,

sentryProjectId: sentryEnabled ? sentryProjectId ?? null : null,
sentryTemplateId: sentryEnabled ? sentryTemplateId ?? null : null,
sentryLiveUrl: sentryEnabled ? sentryLiveUrl ?? null : null,
sentryTestUrl: sentryEnabled ? sentryTestUrl ?? null : null,
sentryReportingUrl: sentryEnabled ? sentryReportingUrl ?? null : null,
sentryProjectStatus: sentryEnabled ? sentryProjectStatus ?? null : null,
sentryHashingEnabled: sentryEnabled ? !!sentryHashingEnabled : false,
sentryVerisoulEnabled: sentryEnabled ? !!sentryVerisoulEnabled : false,
sentryVerisoulTermFake: sentryEnabled ? !!sentryVerisoulTermFake : false,
sentryVerisoulTermSuspicious: sentryEnabled ? !!sentryVerisoulTermSuspicious : false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        sampleSize: true,
        clickQuota: true,
        supplierCpi: true,
        projectCpi: true,
      },
    });
let sentryResponse: any = null;

if (sentryEnabled) {
  try {
    console.log("👉 SENTRY CALL START");

    // -----------------------------
    // 1. Resolve required values
    // -----------------------------
    const clientUrl =
      process.env.SENTRY_CLIENT_URL ||
      process.env.NEXT_PUBLIC_UI_ORIGIN ||
      "https://opinion-elite.com";

    const templateId =
      sentryTemplateId || process.env.SENTRY_TEMPLATE_ID;

    // -----------------------------
    // 2. HARD VALIDATION
    // -----------------------------
    if (!clientUrl) {
      throw new Error("Missing clientUrl");
    }

    if (!templateId) {
      throw new Error("Missing templateId");
    }

    // -----------------------------
    // 3. CLEAN PAYLOAD (MATCH CURL)
    // -----------------------------
    const payload = {
      name: created.name,
      clientUrl,
      templateId,

      clientName: undefined,
      notes: undefined,

      addStatusToUrl: true,
      dontForwardQueryVariables: false,
      skipQuestions: false,

      verisoulProjectSettings: {
        isEnabled: !!sentryVerisoulEnabled,
        shouldTermFake: !!sentryVerisoulTermFake,
        shouldTermSuspicious: !!sentryVerisoulTermSuspicious,
      },
    };

    // -----------------------------
    // 4. DEBUG LOG
    // -----------------------------
    console.log("🔥 FINAL PAYLOAD:", JSON.stringify(payload, null, 2));

    // -----------------------------
    // 5. API CALL (IMPORTANT FIX)
    // -----------------------------
    sentryResponse = await createSentryProject(payload); // ✅ NO const

    console.log(
      "🔥 FULL SENTRY RESPONSE:",
      JSON.stringify(sentryResponse, null, 2)
    );

    const sentryProject = sentryResponse?.project;

    console.log("🔥 EXTRACTED PROJECT:", sentryProject);

    if (!sentryProject) {
      throw new Error("Sentry project missing in response");
    }

    // -----------------------------
    // 6. DB UPDATE (WITH LOGS)
    // -----------------------------
    console.log("👉 Updating DB with:", sentryProject.projectId);

    const updated = await prisma.project.update({
      where: { id: created.id },
      data: {
        sentryProjectId: sentryProject.projectId,
        sentryLiveUrl: sentryProject.liveUrl,
        sentryTestUrl: sentryProject.testUrl,
        sentryReportingUrl: sentryProject.projectReportingUrl,
        sentryProjectStatus: sentryProject.projectStatus,
      },
    });

    console.log("✅ DB UPDATED:", updated);

  } catch (err: any) {
    console.error("❌ SENTRY FULL ERROR:", err);
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
      { error: "Create failed", detail: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}