// src/app/api/client/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client"; // types only (Edge-safe)

const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const activeParam = searchParams.get("active"); // "true" | "false" | null
    const mode = searchParams.get("mode");          // "lite" for dropdowns
    const page = toInt(searchParams.get("page"), 1);
    const pageSize = clamp(toInt(searchParams.get("pageSize"), 10), 1, 100); // cap

    const base: Prisma.ClientWhereInput = q
      ? {
          OR: [
            { code:        { contains: q, mode: "insensitive" } as any },
            { name:        { contains: q, mode: "insensitive" } as any },
            { countryCode: { contains: q, mode: "insensitive" } as any },
          ],
        }
      : {};

    const where: Prisma.ClientWhereInput =
      activeParam === "true"
        ? { ...base, projects: { some: {} } }
        : activeParam === "false"
        ? { ...base, projects: { none: {} } }
        : base;

    const lite = mode === "lite";

    if (lite) {
      const [items, total] = await Promise.all([
        prisma.client.findMany({
          where,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.client.count({ where }),
      ]);
      return NextResponse.json({ items, total });
    }

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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load clients", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
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
  } catch (err: any) {
    // Map a couple of common Prisma errors to 400s
    const code = err?.code as string | undefined;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate client (unique constraint)" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Create failed", detail: String(err?.message ?? err) },
      { status: 400 }
    );
  }
}