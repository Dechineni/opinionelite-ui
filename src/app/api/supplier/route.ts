// FILE: src/app/api/suppliers/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/* ------------------------------ small helpers ------------------------------ */
const toInt = (v: string | null, d: number) =>
  v ? (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d) : d;

// cap pageSize to protect the edge function
const boundedPageSize = (v: string | null, d = 10, max = 100) => {
  const n = toInt(v, d);
  return Math.min(Math.max(n, 1), max);
};

const truthy = (v: string | null) =>
  v !== null && ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/* ----------------------------------- GET ----------------------------------- */
/**
 * GET /api/suppliers?q=&country=&api=&page=&pageSize=
 */
export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get('q') ?? '').trim();
  const country = (searchParams.get('country') ?? '').trim();
  const apiFlag = searchParams.get('api');
  const page = Math.max(1, toInt(searchParams.get('page'), 1));
  const pageSize = boundedPageSize(searchParams.get('pageSize'), 10, 100);

  const where: Prisma.SupplierWhereInput = {
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { website: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { countryCode: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(country ? { countryCode: country } : {}),
    ...(apiFlag !== null ? { api: truthy(apiFlag) } : {}),
  };

  try {
    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // Keep the full shape; if you want to lighten payloads later,
        // add a `select` here and mirror the UI fields.
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to load suppliers', detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

/* ---------------------------------- POST ----------------------------------- */
/**
 * POST /api/suppliers
 * Body: matches the AddSupplier.tsx payload
 */
export async function POST(req: Request) {
  const prisma = getPrisma();

  let b: any;
  try {
    b = await req.json();
  } catch {
    return bad('Invalid JSON');
  }

  // very light validation (the form already enforces required fields)
  if (!b?.name || !b?.countryCode) {
    return bad('name and countryCode are required.');
  }

  try {
    const created = await prisma.supplier.create({
      data: {
        name: String(b.name),
        website: b.website || null,

        countryCode: String(b.countryCode),

        email: b.email || null,
        contactNumber: b.contactNumber || null,

        panelSize:
          b.panelSize === null || b.panelSize === undefined || b.panelSize === ''
            ? null
            : Number(b.panelSize),

        completeUrl: String(b.completeUrl),
        terminateUrl: String(b.terminateUrl),
        overQuotaUrl: String(b.overQuotaUrl),
        qualityTermUrl: String(b.qualityTermUrl),
        surveyCloseUrl: String(b.surveyCloseUrl),

        about: b.about || null,

        // expects a string[] (text[]) in Postgres
        allowedCountries: Array.isArray(b.allowedCountries)
          ? (b.allowedCountries as string[]).map(String)
          : [],

        api: !!b.api,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Unique constraint failed (duplicate value).' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Create failed', detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}