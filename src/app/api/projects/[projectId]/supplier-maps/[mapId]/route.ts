// FILE: src/app/api/projects/[projectId]/supplier-maps/[mapId]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";

const RedirectionType = z.enum([
  "STATIC_REDIRECT",
  "STATIC_POSTBACK",
  "DYNAMIC_REDIRECT",
  "DYNAMIC_POSTBACK",
]);

const UpdateSchema = z.object({
  supplierQuota: z.number().int().nonnegative().optional(),
  clickQuota: z.number().int().nonnegative().optional(),
  cpi: z.number().nonnegative().optional(),
  redirectionType: RedirectionType.optional(),
  allowTraffic: z.boolean().optional(),
  supplierProjectId: z.string().nullable().optional(),
  completeUrl: z.string().url().optional(),
  terminateUrl: z.string().url().optional(),
  overQuotaUrl: z.string().url().optional(),
  qualityTermUrl: z.string().url().optional(),
  surveyCloseUrl: z.string().url().optional(),
});

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  // breadcrumb so we can see exactly which handler ran in CF logs
  console.log("[PUT] /projects/:projectId/supplier-maps/:mapId");

  const prisma = getPrisma();
  const { projectId, mapId } = await ctx.params;

  // 1) validate path + existence (NO transactions)
  if (!projectId || !mapId) return bad("projectId/mapId missing");

  const existing = await prisma.projectSupplierMap.findUnique({
    where: { id: mapId },
    select: { id: true, projectId: true, redirectionType: true },
  });
  if (!existing || existing.projectId !== projectId) {
    return bad("Supplier map not found", 404);
  }

  // 2) parse body
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return bad(parsed.error.flatten().formErrors.join("; ") || "Invalid payload");
  }
  const data = parsed.data;

  // 3) build plain update object (NO nested writes that could hint a tx)
  const updateData: any = {};
  if (data.supplierQuota !== undefined) updateData.quota = data.supplierQuota;
  if (data.clickQuota !== undefined) updateData.clickQuota = data.clickQuota;
  if (data.cpi !== undefined) updateData.cpi = data.cpi;
  if (data.allowTraffic !== undefined) updateData.allowTraffic = data.allowTraffic;
  if (data.supplierProjectId !== undefined) updateData.supplierProjectId = data.supplierProjectId;
  if (data.redirectionType) updateData.redirectionType = data.redirectionType;

  const effectiveType = (data.redirectionType ?? existing.redirectionType);
  if (effectiveType === "STATIC_REDIRECT" || effectiveType === "DYNAMIC_REDIRECT") {
    if (data.completeUrl !== undefined) updateData.completeUrl = data.completeUrl;
    if (data.terminateUrl !== undefined) updateData.terminateUrl = data.terminateUrl;
    if (data.overQuotaUrl !== undefined) updateData.overQuotaUrl = data.overQuotaUrl;
    if (data.qualityTermUrl !== undefined) updateData.qualityTermUrl = data.qualityTermUrl;
    if (data.surveyCloseUrl !== undefined) updateData.surveyCloseUrl = data.surveyCloseUrl;
  } else {
    updateData.completeUrl = null;
    updateData.terminateUrl = null;
    updateData.overQuotaUrl = null;
    updateData.qualityTermUrl = null;
    updateData.surveyCloseUrl = null;
  }

  // 4) single UPDATE + separate supplier fetch (avoid include just to be extra safe)
  try {
    const updated = await prisma.projectSupplierMap.update({
      where: { id: mapId },
      data: updateData,
      select: {
        id: true, projectId: true, supplierId: true, quota: true, clickQuota: true,
        cpi: true, redirectionType: true, postBackUrl: true,
        completeUrl: true, terminateUrl: true, overQuotaUrl: true, qualityTermUrl: true, surveyCloseUrl: true,
        allowTraffic: true, supplierProjectId: true, createdAt: true, updatedAt: true,
      },
    });

    const sup = await prisma.supplier.findUnique({
      where: { id: updated.supplierId },
      select: { code: true, name: true },
    });

    return NextResponse.json({
      ...updated,
      supplierCode: sup?.code ?? "",
      supplierName: sup?.name ?? "",
      supplierQuota: updated.quota,
    });
  } catch (e: any) {
    console.log("prisma:error", e?.message);
    return NextResponse.json(
      { error: "Update failed", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}