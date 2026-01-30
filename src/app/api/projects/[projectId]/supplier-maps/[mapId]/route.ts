// FILE: src/app/api/projects/[projectId]/supplier-maps/[mapId]/route.ts
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

const UpdateSchema = z
  .object({
    supplierQuota: z.coerce.number().int().nonnegative().optional(),
    clickQuota: z.coerce.number().int().nonnegative().optional(),
    cpi: z.coerce.number().nonnegative().optional(),
    redirectionType: RedirectionType.optional(),
    allowTraffic: z.coerce.boolean().optional(),
    supplierProjectId: z.union([z.string().min(1), z.null()]).optional(),

    // Redirect URLs
    completeUrl: z.string().url().nullable().optional(),
    terminateUrl: z.string().url().nullable().optional(),
    overQuotaUrl: z.string().url().nullable().optional(),
    qualityTermUrl: z.string().url().nullable().optional(),
    surveyCloseUrl: z.string().url().nullable().optional(),

    // Postback
    postBackUrl: z.string().url().nullable().optional(),
  })
  .strict();

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

function buildSupplierUrl(opts: { uiBase: string; projectCode: string; supplierCode: string }) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  const p = encodeURIComponent(opts.projectCode || "");
  const s = encodeURIComponent(opts.supplierCode || "");
  return `${ui}/Survey?projectId=${p}&supplierId=${s}&id=[identifier]`;
}

/* ---------------------------------- PUT ---------------------------------- */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey, mapId } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return badJSON("Project not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badJSON("Invalid JSON", 400);
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg =
      flat.formErrors.join("; ") ||
      Object.values(flat.fieldErrors).flat().join("; ") ||
      "Invalid payload";
    return badJSON(msg, 400);
  }

  // Ensure map belongs to project
  const existing = await prisma.projectSupplierMap.findFirst({
    where: { id: mapId, projectId: projId },
    select: { id: true, supplierId: true, projectId: true },
  });
  if (!existing) return badJSON("Supplier map not found", 404);

  // Fetch supplier code + project code for supplierUrl
  const [supplier, project] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: existing.supplierId },
      select: { code: true },
    }),
    prisma.project.findUnique({
      where: { id: existing.projectId },
      select: { code: true },
    }),
  ]);

  const uiBase =
    (process.env.APP_PUBLIC_BASE_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_UI_ORIGIN || "").trim() ||
    "https://opinion-elite.com";

  const supplierUrl =
    supplier?.code && project?.code
      ? buildSupplierUrl({
          uiBase,
          projectCode: String(project.code),
          supplierCode: String(supplier.code),
        })
      : null;

  const data: any = {};

  if (parsed.data.supplierQuota !== undefined) data.quota = parsed.data.supplierQuota;
  if (parsed.data.clickQuota !== undefined) data.clickQuota = parsed.data.clickQuota;
  if (parsed.data.cpi !== undefined) data.cpi = parsed.data.cpi;
  if (parsed.data.redirectionType !== undefined) data.redirectionType = parsed.data.redirectionType;
  if (parsed.data.allowTraffic !== undefined) data.allowTraffic = parsed.data.allowTraffic;
  if (parsed.data.supplierProjectId !== undefined) data.supplierProjectId = parsed.data.supplierProjectId;

  // URLs
  if (parsed.data.completeUrl !== undefined) data.completeUrl = parsed.data.completeUrl;
  if (parsed.data.terminateUrl !== undefined) data.terminateUrl = parsed.data.terminateUrl;
  if (parsed.data.overQuotaUrl !== undefined) data.overQuotaUrl = parsed.data.overQuotaUrl;
  if (parsed.data.qualityTermUrl !== undefined) data.qualityTermUrl = parsed.data.qualityTermUrl;
  if (parsed.data.surveyCloseUrl !== undefined) data.surveyCloseUrl = parsed.data.surveyCloseUrl;
  if (parsed.data.postBackUrl !== undefined) data.postBackUrl = parsed.data.postBackUrl;

  // ✅ Always keep supplierUrl in sync
  if (supplierUrl) data.supplierUrl = supplierUrl;

  const updated = await prisma.projectSupplierMap.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ item: updated });
}

/* -------------------------------- DELETE --------------------------------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey, mapId } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return badJSON("Project not found", 404);

  const existing = await prisma.projectSupplierMap.findFirst({
    where: { id: mapId, projectId: projId },
    select: { id: true },
  });
  if (!existing) return badJSON("Supplier map not found", 404);

  await prisma.projectSupplierMap.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
