// FILE: src/app/api/projects/[projectId]/supplier-maps/[mapId]/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

const RedirectionType = z.enum([
  "STATIC_REDIRECT",
  "STATIC_POSTBACK",
  "DYNAMIC_REDIRECT",
  "DYNAMIC_POSTBACK",
]);

// What we allow to update via PUT
const UpdateSchema = z.object({
  supplierQuota: z.number().int().nonnegative().optional(),
  clickQuota: z.number().int().nonnegative().optional(),
  cpi: z.number().nonnegative().optional(),
  redirectionType: RedirectionType.optional(),
  allowTraffic: z.boolean().optional(),
  supplierProjectId: z.string().nullable().optional(),

  // Redirect urls (used only for *REDIRECT types)
  completeUrl: z.string().url().optional(),
  terminateUrl: z.string().url().optional(),
  overQuotaUrl: z.string().url().optional(),
  qualityTermUrl: z.string().url().optional(),
  surveyCloseUrl: z.string().url().optional(),
});

function bad(msg: string, code = 400) {
  return new NextResponse(msg, { status: code });
}

/** PUT: update a supplier map */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId, mapId } = await ctx.params;

  if (!projectId || !mapId) return bad("projectId/mapId missing", 400);

  // 1) Make sure the row exists and belongs to this project
  const existing = await prisma.projectSupplierMap.findUnique({
    where: { id: mapId },
    select: { id: true, projectId: true, redirectionType: true },
  });
  if (!existing || existing.projectId !== projectId) {
    return bad("Supplier map not found", 404);
  }

  // 2) Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON", 400);
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return bad(parsed.error.flatten().formErrors.join("; ") || "Invalid payload", 400);
  }
  const data = parsed.data;

  // 3) Build update
  //    Note: DB column for supplier quota is `quota`
  const updateData: any = {};
  if (data.supplierQuota !== undefined) updateData.quota = data.supplierQuota;
  if (data.clickQuota !== undefined) updateData.clickQuota = data.clickQuota;
  if (data.cpi !== undefined) updateData.cpi = data.cpi;
  if (data.allowTraffic !== undefined) updateData.allowTraffic = data.allowTraffic;
  if (data.supplierProjectId !== undefined) updateData.supplierProjectId = data.supplierProjectId;

  // redirection type change
  if (data.redirectionType) {
    updateData.redirectionType = data.redirectionType;
  }

  // If the resulting type is a *REDIRECT, allow the 5 URLs to be updated.
  // If it's a *POSTBACK, clear those URLs.
  const effectiveType = (data.redirectionType ?? existing.redirectionType) as z.infer<typeof RedirectionType>;
  if (effectiveType === "STATIC_REDIRECT" || effectiveType === "DYNAMIC_REDIRECT") {
    // Only set provided URLs (leave others as-is)
    if (data.completeUrl !== undefined) updateData.completeUrl = data.completeUrl;
    if (data.terminateUrl !== undefined) updateData.terminateUrl = data.terminateUrl;
    if (data.overQuotaUrl !== undefined) updateData.overQuotaUrl = data.overQuotaUrl;
    if (data.qualityTermUrl !== undefined) updateData.qualityTermUrl = data.qualityTermUrl;
    if (data.surveyCloseUrl !== undefined) updateData.surveyCloseUrl = data.surveyCloseUrl;
  } else {
    // Clear URLs for postback types
    updateData.completeUrl = null;
    updateData.terminateUrl = null;
    updateData.overQuotaUrl = null;
    updateData.qualityTermUrl = null;
    updateData.surveyCloseUrl = null;
  }

  // 4) Update and return with supplier flattened data
  const updated = await prisma.projectSupplierMap.update({
    where: { id: mapId },
    data: updateData,
    include: { supplier: { select: { id: true, code: true, name: true } } },
  });

  return NextResponse.json(updated);
}

/** DELETE (optional): keep if you still support delete from elsewhere */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId, mapId } = await ctx.params;
  const row = await prisma.projectSupplierMap.findUnique({
    where: { id: mapId },
    select: { id: true, projectId: true },
  });
  if (!row || row.projectId !== projectId) return bad("Not found", 404);
  await prisma.projectSupplierMap.delete({ where: { id: mapId } });
  return NextResponse.json({ ok: true });
}