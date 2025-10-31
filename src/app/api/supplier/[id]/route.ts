// FILE: src/app/api/supplier/[id]/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ------------------------------- GET /:id ------------------------------- */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const item = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      website: true,
      countryCode: true,
      email: true,
      contactNumber: true,
      panelSize: true,
      completeUrl: true,
      terminateUrl: true,
      overQuotaUrl: true,
      qualityTermUrl: true,
      surveyCloseUrl: true,
      about: true,
      allowedCountries: true,
      api: true,
      // add createdAt/updatedAt if you ever need them:
      // createdAt: true,
      // updatedAt: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

/* ------------------------------ PATCH /:id ------------------------------ */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const b = await req.json();

  const data: Prisma.SupplierUpdateInput = {
    name: b.name,
    website: b.website ?? null,
    countryCode: b.countryCode,
    email: b.email ?? null,
    contactNumber: b.contactNumber ?? null,
    panelSize:
      b.panelSize === null || b.panelSize === undefined
        ? null
        : Number(b.panelSize),
    completeUrl: b.completeUrl,
    terminateUrl: b.terminateUrl,
    overQuotaUrl: b.overQuotaUrl,
    qualityTermUrl: b.qualityTermUrl,
    surveyCloseUrl: b.surveyCloseUrl,
    about: b.about ?? null,
    allowedCountries: Array.isArray(b.allowedCountries)
      ? b.allowedCountries
      : [],
    api: !!b.api,
  };

  try {
    const updated = await prisma.supplier.update({
      where: { id },
      data,
    });
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

/* ----------------------------- DELETE /:id ------------------------------ */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    await prisma.supplier.delete({ where: { id } });
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