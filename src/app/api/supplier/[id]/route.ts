// FILE: src/app/api/supplier/[id]/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/* ------------------------------ helpers ------------------------------ */

// support /api/supplier/:id  OR  /api/supplier/:code?by=code
function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get('by');
  return by === 'code' ? { code: id } : { id };
}

// drop undefined keys so Prisma validates less
function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out as Partial<T>;
}

/* ------------------------------- GET /:id ------------------------------- */
// GET /api/supplier/:id
// GET /api/supplier/:code?by=code
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);

  const item = await prisma.supplier.findUnique({
    where,
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
    },
  });

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

/* ------------------------------ PATCH /:id ------------------------------ */
// PATCH /api/supplier/:id
// PATCH /api/supplier/:code?by=code
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);
  const b = await req.json();

  // coerce a few fields
  const panelSize =
    b.panelSize === null || b.panelSize === undefined || b.panelSize === ''
      ? null
      : Number(b.panelSize);

  const data = clean<Prisma.SupplierUpdateInput>({
    name: b.name,
    website: b.website ?? null,
    countryCode: b.countryCode,
    email: b.email ?? null,
    contactNumber: b.contactNumber ?? null,
    panelSize: panelSize as any, // Prisma accepts number|null here
    completeUrl: b.completeUrl,
    terminateUrl: b.terminateUrl,
    overQuotaUrl: b.overQuotaUrl,
    qualityTermUrl: b.qualityTermUrl,
    surveyCloseUrl: b.surveyCloseUrl,
    about: b.about ?? null,
    allowedCountries: Array.isArray(b.allowedCountries) ? b.allowedCountries : [],
    api: typeof b.api === 'boolean' ? b.api : undefined,
  });

  try {
    const updated = await prisma.supplier.update({
      where,
      data,
      // return only what UI needs right away
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
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Update failed', detail: String(e) },
      { status: 400 }
    );
  }
}

/* ----------------------------- DELETE /:id ------------------------------ */
// DELETE /api/supplier/:id
// DELETE /api/supplier/:code?by=code
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);

  try {
    await prisma.supplier.delete({ where });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Delete failed', detail: String(e) },
      { status: 400 }
    );
  }
}