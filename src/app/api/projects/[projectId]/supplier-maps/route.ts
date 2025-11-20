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

// Accept "10" or 10, "true"/"false" etc.
const BaseSchema = z.object({
  supplierId: z.string().min(1, "supplierId required"),
  supplierQuota: z.coerce.number().int().nonnegative(),
  clickQuota: z.coerce.number().int().nonnegative(),
  cpi: z.coerce.number().nonnegative(),
  redirectionType: RedirectionType,
  allowTraffic: z.coerce.boolean().optional().default(false),
  supplierProjectId: z.union([z.string().min(1), z.null()]).optional(),
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
  return NextResponse.json({ error: msg }, { status: code });
}

async function resolveProjectId(projectKey: string) {
  const prisma = getPrisma();
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectKey }, { code: projectKey }] },
    select: { id: true },
  });
  return p?.id ?? null;
}

/* ---------------------------------- GET ---------------------------------- */
/** List supplier maps with flattened supplier info + counts (CPU-light). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return badJSON("Project not found", 404);

  // 1) Base maps + supplier info
  const maps = await prisma.projectSupplierMap.findMany({
    where: { projectId: projId },
    orderBy: { createdAt: "asc" },
    include: { supplier: { select: { id: true, code: true, name: true } } },
  });

  // 2) Aggregate results from SupplierRedirectEvent (idempotent per pid)
  let bySupplier: Record<string, Record<string, number>> = {};
  try {
    const agg = await prisma.supplierRedirectEvent.groupBy({
      by: ["supplierId", "outcome"],
      where: { projectId: projId, supplierId: { not: null } },
      _count: { _all: true },
    });

    bySupplier = agg.reduce((acc, row) => {
      if (!row.supplierId || !row.outcome) return acc;
      const sid = row.supplierId;
      acc[sid] ??= {};
      // map to UI keys
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
      acc[sid][key] = row._count._all;
      return acc;
    }, {} as Record<string, Record<string, number>>);
  } catch {
    // ignore aggregation failures; they shouldn't break list view
  }

  const items = maps.map((m) => {
    const c = bySupplier[m.supplierId] ?? {};
    const complete = c.COMPLETE ?? 0;
    const terminate = c.TERMINATE ?? 0;
    const overQuota = c.OVERQUOTA ?? 0;
    const qualityTerm = c.QUALITYTERM ?? 0;
    const close = c.CLOSE ?? 0;

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
      total: complete + terminate + overQuota + qualityTerm + close,
      complete,
      terminate,
      overQuota,
      dropOut: 0, // (wire DROP_OUT later if you start recording it)
      qualityTerm,
    };
  });

  return NextResponse.json({ items });
}

/* ---------------------------------- POST --------------------------------- */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } = await ctx.params;

  try {
    const projId = await resolveProjectId(projectKey);
    if (!projId) return badJSON("Project not found", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badJSON("Invalid JSON", 400);
    }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg =
        flat.formErrors.join("; ") ||
        Object.values(flat.fieldErrors).flat().join("; ") ||
        "Invalid payload";
      return badJSON(msg, 400);
    }
    const data = parsed.data;

    // Verify supplier exists (simple single-table read)
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, code: true, name: true },
    });
    if (!supplier) return badJSON("Supplier not found", 404);

    // Build payload for ProjectSupplierMap (simple single-table write)
    const createData: any = {
      projectId: projId,
      supplierId: data.supplierId,
      quota: data.supplierQuota,
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
      createData.postBackUrl = (data as any).postBackUrl;
    }

    // Single-table create, no include, no transaction
    const created = await prisma.projectSupplierMap.create({
      data: createData,
    });

    // Build response using the supplier we already fetched
    return NextResponse.json(
      {
        item: {
          id: created.id,
          projectId: created.projectId,
          supplierId: created.supplierId,
          supplierCode: supplier.code ?? "",
          supplierName: supplier.name ?? "",
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
  } catch (e: any) {
    const msg = String(e?.message || e);
    const hint = msg.includes("Transactions are not supported")
      ? " Prisma HTTP/Data Proxy on Cloudflare does not support $transaction or nested writes. This route now uses only simple single-table reads/writes (supplier.findUnique, projectSupplierMap.create). If you still see this, please confirm there is no older build or other middleware calling prisma.$transaction in this request."
      : "";

    return NextResponse.json(
      { error: "Failed to create supplier map", detail: msg + hint },
      { status: 400 }
    );
  }
}