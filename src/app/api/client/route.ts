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
    const mode = searchParams.get("mode"); // "lite" for dropdowns
    const apiOnly = searchParams.get("apiOnly"); // "1" to return only API-enabled clients
    const page = toInt(searchParams.get("page"), 1);
    const pageSize = clamp(toInt(searchParams.get("pageSize"), 10), 1, 100);

    const base: Prisma.ClientWhereInput = q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } as any },
            { name: { contains: q, mode: "insensitive" } as any },
            { countryCode: { contains: q, mode: "insensitive" } as any },
          ],
        }
      : {};

    const activeWhere: Prisma.ClientWhereInput =
      activeParam === "true"
        ? { projects: { some: {} } }
        : activeParam === "false"
        ? { projects: { none: {} } }
        : {};

    const apiWhere: Prisma.ClientWhereInput =
      apiOnly === "1"
        ? {
            apiUrl: {
              not: null,
            },
          }
        : {};

    const where: Prisma.ClientWhereInput = {
      AND: [base, activeWhere, apiWhere],
    };

    const lite = mode === "lite";

    if (lite) {
      const [items, total] = await Promise.all([
        prisma.client.findMany({
          where,
          orderBy: { name: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            countryCode: true,
            apiUrl: true,
            apiKey: true,
            secretKey: true,
            providerType: true,
            memberApiUrl: true,
            partnerGuid: true,
            panelGuidEnUs: true,
            panelGuidEnGb: true,
          },
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
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          contactNumber: true,
          countryCode: true,
          website: true,
          apiUrl: true,
          apiKey: true,
          secretKey: true,
          providerType: true,
          memberApiUrl: true,
          partnerGuid: true,
          panelGuidEnUs: true,
          panelGuidEnGb: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.client.count({ where }),
      prisma.client.count({ where: { AND: [base, { projects: { some: {} } }] } }),
      prisma.client.count({ where: { AND: [base, { projects: { none: {} } }] } }),
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
        apiUrl: b.apiUrl ?? null,
        apiKey: b.apiKey ?? null,
        secretKey: b.secretKey ?? null,
        providerType: b.providerType ?? null,
        memberApiUrl: b.memberApiUrl ?? null,
        partnerGuid: b.partnerGuid ?? null,
        panelGuidEnUs: b.panelGuidEnUs ?? null,
        panelGuidEnGb: b.panelGuidEnGb ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
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