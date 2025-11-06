// FILE: src/app/api/projects/[projectId]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

/* ------------------------------ helpers ------------------------------ */
function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

const num = (v: any) => (v === undefined ? undefined : Number(v));
const maybeDate = (v: any) => (v ? new Date(v) : undefined);

// Non-nullable decimal → string | undefined (never null)
function decimalStrNN(v: any): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

// Nullable decimal → string | null | undefined
function decimalStrNullable(v: any): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return String(v);
}

/* -------------------------------- GET -------------------------------- */
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

/* ------------------------------- PATCH ------------------------------- */
/**
 * Scalar-only update (no nested relation writes) so HTTP mode won't try
 * interactive transactions under the hood.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  console.log("[PATCH] /api/projects/:projectId (scalar update only)");
  const prisma = getPrisma();
  const { projectId } = await ctx.params;
  const where = whereFrom(req, projectId);
  const b = await req.json();

  const data: Prisma.ProjectUpdateInput = {
    code: b.code,

    name: b.name ?? b.projectName,
    managerEmail: b.manager ?? b.managerEmail,
    category: b.category,
    status: (b.status as ProjectStatus) ?? undefined,
    description: b.description,

    // set FK columns directly (no connect/disconnect)
    client:
    b.clientId === undefined
    ? undefined
    : { connect: { id: String(b.clientId) } },

    group:
    b.groupId === undefined
    ? undefined
    : b.groupId === null
    ? { disconnect: true }
    : { connect: { id: String(b.groupId) } },

    countryCode: b.country ?? b.countryCode,
    languageCode: b.language ?? b.languageCode,
    currency: b.currency,

    loi: num(b.loi),
    ir: num(b.ir),
    sampleSize: num(b.sampleSize),
    clickQuota: num(b.clickQuota),

    // decimals (projectCpi NOT NULL, supplierCpi nullable)
  projectCpi: decimalStrNN(b.projectCpi),          // NOT NULL in schema
  supplierCpi: decimalStrNullable(b.supplierCpi),  // NULLABLE in schema

    // dates
    startDate: maybeDate(b.startDate),
    endDate: maybeDate(b.endDate),

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
    uniqueIpDepth: b.uniqueIpDepth === undefined ? undefined : Number(b.uniqueIpDepth),
    tSign: typeof b.tSign === "boolean" ? b.tSign : undefined,
    speeder: typeof b.speeder === "boolean" ? b.speeder : undefined,
    speederDepth: b.speederDepth === undefined ? undefined : Number(b.speederDepth),

    mobile: typeof b.mobile === "boolean" ? b.mobile : undefined,
    tablet: typeof b.tablet === "boolean" ? b.tablet : undefined,
    desktop: typeof b.desktop === "boolean" ? b.desktop : undefined,
  };

  try {
    const updated = await prisma.project.update({ where, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.log("prisma:error", e?.message);
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Update failed", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}

/* ------------------------------ DELETE ------------------------------ */
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