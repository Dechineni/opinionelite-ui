// FILE: src/app/api/supplier/lite/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);

  // optional search & limit to protect the edge
  const q = (searchParams.get('q') ?? '').trim();
  const limitParam = searchParams.get('limit');
  // default 50, cap at 200
  const limit = Math.min(Math.max(Number(limitParam || 50) || 50, 1), 200);

  const where: Prisma.SupplierWhereInput = q
    ? {
        OR: [
          { code:  { contains: q, mode: Prisma.QueryMode.insensitive } },
          { name:  { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const items = await prisma.supplier.findMany({
    where,
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
    take: limit,
  });

  // Keep response as a plain array so the UI can do `.slice()`
  return NextResponse.json(items);
}