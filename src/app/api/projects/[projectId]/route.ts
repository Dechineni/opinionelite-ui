// FILE: src/app/api/projects/[projectId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

const toDecimal = (v: any) =>
  v === undefined || v === null || v === "" ? undefined : new Prisma.Decimal(v);

/* ------------------------------- GET ------------------------------- */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;     // ← await it
  const where = whereFrom(req, projectId);
  const item = await prisma.project.findUnique({ where });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

/* ------------------------------ PATCH ------------------------------ */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;     // ← await it
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

    loi: b.loi !== undefined ? Number(b.loi) : undefined,
    ir: b.ir !== undefined ? Number(b.ir) : undefined,
    sampleSize: b.sampleSize !== undefined ? Number(b.sampleSize) : undefined,
    clickQuota: b.clickQuota !== undefined ? Number(b.clickQuota) : undefined,

    projectCpi: toDecimal(b.projectCpi),
    supplierCpi: b.supplierCpi === null ? null : toDecimal(b.supplierCpi),

    startDate: b.startDate ? new Date(b.startDate) : undefined,
    endDate: b.endDate ? new Date(b.endDate) : undefined,

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
    return NextResponse.json({ error: "Update failed", detail: String(e) }, { status: 400 });
  }
}

/* ----------------------------- DELETE ------------------------------ */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;     // ← await it
  try {
    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Delete failed", detail: String(e) }, { status: 400 });
  }
}