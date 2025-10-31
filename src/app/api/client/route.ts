// src/app/api/client/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";          // adjust path if needed
import { Prisma } from "@prisma/client";        // <-- for types and QueryMode enum

const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const activeParam = searchParams.get("active"); // "true" | "false" | null
  const mode = searchParams.get("mode");          // <-- "lite" for dropdowns
  const page = toInt(searchParams.get("page"), 1);
  const pageSize = toInt(searchParams.get("pageSize"), 10);

  const base: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { code:        { contains: q, mode: Prisma.QueryMode.insensitive } },
          { name:        { contains: q, mode: Prisma.QueryMode.insensitive } },
          { countryCode: { contains: q, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const where: Prisma.ClientWhereInput =
    activeParam === "true"
      ? { ...base, projects: { some: {} } }
      : activeParam === "false"
      ? { ...base, projects: { none: {} } }
      : base;

  // When mode=lite, only return id + name (for dropdown)
  const lite = mode === "lite";

  if (lite) {
    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        select: { id: true, name: true }, // <-- only what we need
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.client.count({ where }),
    ]);
    return NextResponse.json({ items, total });
  }

  // full payload (unchanged)
  const [items, total, activeCount, inactiveCount] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
    prisma.client.count({ where: { ...base, projects: { some: {} } } }),
    prisma.client.count({ where: { ...base, projects: { none: {} } } }),
  ]);

  return NextResponse.json({
    items,
    total,
    active: activeCount,
    inactive: inactiveCount,
  });
}

export async function POST(req: Request) {
  const b = await req.json();

  const created = await prisma.client.create({
    data: {
      name: b.name ?? b.clientName,
      contactPerson: b.contactPerson ?? "",
      email: b.email ?? null,
      contactNumber: b.contactNumber ?? null,
      countryCode: b.countryCode ?? b.country ?? "US",
      website: b.website ?? null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}