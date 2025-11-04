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

// Coerce so the API can accept "10" or 10, "true"/"false" etc.
const UpdateSchema = z.object({
  supplierQuota: z.coerce.number().int().nonnegative().optional(),
  clickQuota: z.coerce.number().int().nonnegative().optional(),
  cpi: z.coerce.number().nonnegative().optional(),
  redirectionType: RedirectionType.optional(),
  allowTraffic: z.coerce.boolean().optional(),
  supplierProjectId: z
    .union([z.string().min(1), z.null()])
    .optional(),

  // only relevant for *REDIRECT types
  completeUrl: z.string().url().optional(),
  terminateUrl: z.string().url().optional(),
  overQuotaUrl: z.string().url().optional(),
  qualityTermUrl: z.string().url().optional(),
  surveyCloseUrl: z.string().url().optional(),
});

function badJSON(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

async function resolveProjectId(projectIdOrCode: string) {
  const prisma = getPrisma();
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true },
  });
  return p?.id ?? null;
}

/* --------------------------------- PUT ---------------------------------- */
/** Update a supplier map row (scoped to project) */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey, mapId } = await ctx.params;

  if (!projectKey || !mapId) return badJSON("projectId/mapId missing", 400);

  // Resolve project (accept id or code)
  const projId = await resolveProjectId(projectKey);
  if (!projId) return badJSON("Project not found", 404);

  // Cheap ownership + current type check
  const existing = await prisma.projectSupplierMap.findFirst({
    where: { id: mapId, projectId: projId },
    select: { id: true, redirectionType: true },
  });
  if (!existing) return badJSON("Supplier map not found", 404);

  // Parse & validate body
  let parsedBody: z.infer<typeof UpdateSchema>;
  try {
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg =
        flat.formErrors.join("; ") ||
        Object.values(flat.fieldErrors).flat().join("; ") ||
        "Invalid payload";
      return badJSON(msg, 400);
    }
    parsedBody = parsed.data;
  } catch {
    return badJSON("Invalid JSON", 400);
  }

  // Build update payload
  const updateData: any = {};
  if (parsedBody.supplierQuota !== undefined)
    updateData.quota = parsedBody.supplierQuota;
  if (parsedBody.clickQuota !== undefined)
    updateData.clickQuota = parsedBody.clickQuota;
  if (parsedBody.cpi !== undefined) updateData.cpi = parsedBody.cpi;
  if (parsedBody.allowTraffic !== undefined)
    updateData.allowTraffic = parsedBody.allowTraffic;
  if (parsedBody.supplierProjectId !== undefined)
    updateData.supplierProjectId = parsedBody.supplierProjectId;

  // Handle redirectionType and URLs
  if (parsedBody.redirectionType) {
    updateData.redirectionType = parsedBody.redirectionType;
  }
  const effectiveType = parsedBody.redirectionType ?? existing.redirectionType;

  if (effectiveType === "STATIC_REDIRECT" || effectiveType === "DYNAMIC_REDIRECT") {
    // Only set provided URLs (leave others unchanged)
    if (parsedBody.completeUrl !== undefined)
      updateData.completeUrl = parsedBody.completeUrl;
    if (parsedBody.terminateUrl !== undefined)
      updateData.terminateUrl = parsedBody.terminateUrl;
    if (parsedBody.overQuotaUrl !== undefined)
      updateData.overQuotaUrl = parsedBody.overQuotaUrl;
    if (parsedBody.qualityTermUrl !== undefined)
      updateData.qualityTermUrl = parsedBody.qualityTermUrl;
    if (parsedBody.surveyCloseUrl !== undefined)
      updateData.surveyCloseUrl = parsedBody.surveyCloseUrl;
  } else {
    // POSTBACK types don’t use redirect URLs → clear them
    updateData.completeUrl = null;
    updateData.terminateUrl = null;
    updateData.overQuotaUrl = null;
    updateData.qualityTermUrl = null;
    updateData.surveyCloseUrl = null;
  }

  // Update (scoped by id + projectId to avoid cross-project edits)
  try {
    const updated = await prisma.projectSupplierMap.update({
      where: { id: mapId },
      data: updateData,
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return badJSON(`Update failed: ${String(e?.message ?? e)}`, 400);
  }
}

/* ------------------------------- DELETE --------------------------------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; mapId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey, mapId } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return badJSON("Project not found", 404);

  const row = await prisma.projectSupplierMap.findFirst({
    where: { id: mapId, projectId: projId },
    select: { id: true },
  });
  if (!row) return badJSON("Not found", 404);

  await prisma.projectSupplierMap.delete({ where: { id: mapId } });
  return NextResponse.json({ ok: true });
}