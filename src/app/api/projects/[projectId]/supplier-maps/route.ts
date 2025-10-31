// FILE: src/app/api/projects/[projectId]/supplier-maps/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Must match your Prisma enum
const RedirectionType = z.enum([
  "STATIC_REDIRECT",
  "STATIC_POSTBACK",
  "DYNAMIC_REDIRECT",
  "DYNAMIC_POSTBACK",
]);

// Shared fields from the client payload
const BaseSchema = z.object({
  supplierId: z.string().min(1, "supplierId required"),
  supplierQuota: z.number().int().nonnegative(),
  clickQuota: z.number().int().nonnegative(),
  cpi: z.number().nonnegative(),
  redirectionType: RedirectionType,

  // optional toggles/metadata stored in DB
  allowTraffic: z.boolean().optional().default(false),
  supplierProjectId: z.string().optional().nullable(),
});

// Redirect variants: require 5 outcome URLs
const RedirectUrls = z.object({
  completeUrl: z.string().url(),
  terminateUrl: z.string().url(),
  overQuotaUrl: z.string().url(),
  qualityTermUrl: z.string().url(),
  surveyCloseUrl: z.string().url(),
});

// PostBack variants: require a single postBackUrl
const PostBackUrl = z.object({
  postBackUrl: z.string().url(),
});

// Discriminated union by redirectionType
const CreateSchema = z.discriminatedUnion("redirectionType", [
  // Redirects
  BaseSchema.merge(RedirectUrls).extend({
    redirectionType: z.literal("STATIC_REDIRECT"),
  }),
  BaseSchema.merge(RedirectUrls).extend({
    redirectionType: z.literal("DYNAMIC_REDIRECT"),
  }),
  // PostBacks
  BaseSchema.merge(PostBackUrl).extend({
    redirectionType: z.literal("STATIC_POSTBACK"),
  }),
  BaseSchema.merge(PostBackUrl).extend({
    redirectionType: z.literal("DYNAMIC_POSTBACK"),
  }),
]);

function bad(msg: string, code = 400) {
  return new NextResponse(msg, { status: code });
}

/**
 * GET: list all supplier maps for a project
 * - Flattens Supplier info into supplierCode / supplierName
 * - Adds zeroed outcome counters (ready to be wired to Thanks/Index logs)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  if (!projectId) return bad("projectId missing", 400);

  // 1) Base maps + supplier info
  const maps = await prisma.projectSupplierMap.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { supplier: { select: { id: true, code: true, name: true } } },
  });

  // 2) Aggregate results per supplier
  const agg = await prisma.surveyRedirect.groupBy({
    by: ["supplierId", "result"],
    where: { projectId, supplierId: { not: null }, result: { not: null } },
    _count: { _all: true },
  });

  // Build a quick lookup: supplierId -> { COMPLETE, TERMINATE, OVERQUOTA, QUALITYTERM, CLOSE }
  const bySupplier: Record<
    string,
    Partial<Record<NonNullable<(typeof agg)[number]["result"]>, number>>
  > = {};
  for (const row of agg) {
    if (!row.supplierId || !row.result) continue;
    bySupplier[row.supplierId] ??= {};
    bySupplier[row.supplierId][row.result] = row._count._all;
  }

  const items = maps.map((m) => {
    const counts = bySupplier[m.supplierId] ?? {};
    const complete    = counts.COMPLETE    ?? 0;
    const terminate   = counts.TERMINATE   ?? 0;
    const overQuota   = counts.OVERQUOTA   ?? 0;
    const qualityTerm = counts.QUALITYTERM ?? 0;
    const close       = counts.CLOSE       ?? 0;

    return {
      id: m.id,
      projectId: m.projectId,
      supplierId: m.supplierId,
      supplierCode: m.supplier?.code ?? "",
      supplierName: m.supplier?.name ?? "",
      supplierQuota: m.quota,
      clickQuota: m.clickQuota,
      cpi: m.cpi?.toString(),
      redirectionType: m.redirectionType,
      postBackUrl: m.postBackUrl,
      completeUrl: m.completeUrl,
      terminateUrl: m.terminateUrl,
      overQuotaUrl: m.overQuotaUrl,
      qualityTermUrl: m.qualityTermUrl,
      surveyCloseUrl: m.surveyCloseUrl,
      allowTraffic: m.allowTraffic,
      supplierProjectId: m.supplierProjectId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,

      // Counts shown in the UI
      total: complete + terminate + overQuota + qualityTerm + close,
      complete,
      terminate,
      overQuota,
      dropOut: 0,          // left as-is per your last note (no special wiring)
      qualityTerm,
    };
  });

  return NextResponse.json({ items });
}

/** POST: create a supplier map for a project */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  if (!projectId) return bad("projectId missing", 400);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("Invalid JSON", 400);
  }

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return bad(
      parsed.error.flatten().formErrors.join("; ") || "Invalid payload",
      400
    );
  }
  const data = parsed.data;

  // verify project & supplier exist
  const [project, supplier] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true },
    }),
  ]);
  if (!project) return bad("Project not found", 404);
  if (!supplier) return bad("Supplier not found", 404);

  // Build Prisma payload
  const createData: any = {
    projectId,
    supplierId: data.supplierId,
    quota: data.supplierQuota, // UI -> DB column
    clickQuota: data.clickQuota,
    cpi: data.cpi,
    redirectionType: data.redirectionType,
    allowTraffic: data.allowTraffic ?? false,
    supplierProjectId: data.supplierProjectId ?? null,
  };

  if (
    data.redirectionType === "STATIC_REDIRECT" ||
    data.redirectionType === "DYNAMIC_REDIRECT"
  ) {
    createData.completeUrl = (data as any).completeUrl;
    createData.terminateUrl = (data as any).terminateUrl;
    createData.overQuotaUrl = (data as any).overQuotaUrl;
    createData.qualityTermUrl = (data as any).qualityTermUrl;
    createData.surveyCloseUrl = (data as any).surveyCloseUrl;
  } else {
    // PostBack
    createData.postBackUrl = (data as any).postBackUrl;
  }

  const created = await prisma.projectSupplierMap.create({ data: createData });

  // Return the same flattened shape the GET uses (helps caller update UI optimistically)
  const sup = await prisma.supplier.findUnique({
    where: { id: created.supplierId },
    select: { code: true, name: true },
  });

  return NextResponse.json(
    {
      item: {
        id: created.id,
        projectId: created.projectId,
        supplierId: created.supplierId,
        supplierCode: sup?.code ?? "",
        supplierName: sup?.name ?? "",
        supplierQuota: created.quota,
        clickQuota: created.clickQuota,
        cpi: created.cpi?.toString(),
        redirectionType: created.redirectionType,
        postBackUrl: created.postBackUrl,
        completeUrl: created.completeUrl,
        terminateUrl: created.terminateUrl,
        overQuotaUrl: created.overQuotaUrl,
        qualityTermUrl: created.qualityTermUrl,
        surveyCloseUrl: created.surveyCloseUrl,
        allowTraffic: created.allowTraffic,
        supplierProjectId: created.supplierProjectId,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        total: 0,
        complete: 0,
        terminate: 0,
        overQuota: 0,
        dropOut: 0,
        qualityTerm: 0,
      },
    },
    { status: 201 }
  );
}