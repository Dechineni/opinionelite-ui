// FILE: src/app/api/projects/[projectId]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

/* ------------------------------- helpers ------------------------------- */

function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

// Non-nullable decimal: never returns null
const decimalSetNN = (
  v: unknown
): { set: string | number } | undefined => {
  if (v === undefined) return undefined;       // don't touch
  const s = String(v).trim();
  if (s === "") return undefined;              // treat empty as "no change"
  return { set: s };                           // string/number OK
};

// Nullable decimal: may return null
const decimalSetNullable = (
  v: unknown
): { set: string | number | null } | undefined => {
  if (v === undefined) return undefined;       // don't touch
  if (v === null) return { set: null };        // explicitly null
  const s = String(v).trim();
  if (s === "") return undefined;              // no change
  return { set: s };
};

const num = (v: unknown): number | undefined =>
  v === undefined ? undefined : Number(v);

/* -------------------------------- GET --------------------------------- */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;
  const where = whereFrom(req, projectId);

  const item = await prisma.project.findUnique({ where });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(item);
}

/* ------------------------------- PATCH -------------------------------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;
  const where = whereFrom(req, projectId);
  const b = await req.json();

  const data: Prisma.ProjectUpdateInput = {
    code: b.code,
    name: b.name ?? b.projectName,
    managerEmail: b.manager ?? b.managerEmail,
    category: b.category,
    status: b.status as ProjectStatus | undefined,
    description: b.description,

    client: b.clientId ? { connect: { id: String(b.clientId) } } : undefined,
    group:
      b.groupId === null
        ? { disconnect: true }
        : b.groupId
        ? { connect: { id: String(b.groupId) } }
        : undefined,

    countryCode: b.country ?? b.countryCode,
    languageCode: b.language ?? b.languageCode,
    currency: b.currency,

    loi: num(b.loi),
    ir: num(b.ir),
    sampleSize: num(b.sampleSize),
    clickQuota: num(b.clickQuota),

    // 🔑 decimals
    projectCpi: decimalSetNN(b.projectCpi),          // non-nullable
    supplierCpi: decimalSetNullable(b.supplierCpi),  // nullable

    // dates
    startDate: b.startDate ? new Date(b.startDate) : undefined,
    endDate: b.endDate ? new Date(b.endDate) : undefined,

    // booleans
    preScreen: typeof b.preScreen === "boolean" ? b.preScreen : undefined,
    exclude: typeof b.exclude === "boolean" ? b.exclude : undefined,
    geoLocation: typeof b.geoLocation === "boolean" ? b.geoLocation : undefined,
    dynamicThanksUrl:
      typeof b.dynamicThanks === "boolean"
        ? b.dynamicThanks
        : typeof b.dynamicThanksUrl === "boolean"
        ? b.dynamicThanksUrl
        : undefined,
    uniqueIp: typeof b.uniqueIp === "boolean" ? b.uniqueIp : undefined,
    uniqueIpDepth: b.uniqueIpDepth !== undefined ? Number(b.uniqueIpDepth) : undefined,
    tSign: typeof b.tSign === "boolean" ? b.tSign : undefined,
    speeder: typeof b.speeder === "boolean" ? b.speeder : undefined,
    speederDepth: b.speederDepth !== undefined ? Number(b.speederDepth) : undefined,

    mobile: typeof b.mobile === "boolean" ? b.mobile : undefined,
    tablet: typeof b.tablet === "boolean" ? b.tablet : undefined,
    desktop: typeof b.desktop === "boolean" ? b.desktop : undefined,
  };

  try {
    const updated = await prisma.project.update({ where, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Update failed", detail: String(e) },
      { status: 400 }
    );
  }
}

/* ------------------------------ DELETE ------------------------------- */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  try {
    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Delete failed", detail: String(e) },
      { status: 400 }
    );
  }
}