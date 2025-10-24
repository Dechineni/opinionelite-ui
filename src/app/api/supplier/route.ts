// FILE: src/app/api/suppliers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ------------------------------ small helpers ------------------------------ */
const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const truthy = (v: string | null) =>
  v !== null && ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());

/* ----------------------------------- GET ----------------------------------- */
/**
 * GET /api/suppliers?q=&country=&api=&page=&pageSize=
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim();
  const apiFlag = searchParams.get("api");
  const page = toInt(searchParams.get("page"), 1);
  const pageSize = toInt(searchParams.get("pageSize"), 10);

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

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  return NextResponse.json({ items, total });
}

/* ---------------------------------- POST ----------------------------------- */
/**
 * POST /api/suppliers
 * Body: matches the AddSupplier.tsx payload
 */
export async function POST(req: Request) {
  const b = await req.json();

  // very light validation (the form already enforces required fields)
  if (!b?.name || !b?.countryCode) {
    return NextResponse.json(
      { error: "name and countryCode are required." },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.supplier.create({
      data: {
        // id auto (cuid) if your model uses @id @default(cuid())
        // code auto via DB default (sequence)

        name: String(b.name),
        website: b.website || null,

        countryCode: String(b.countryCode),

        email: b.email || null,
        contactNumber: b.contactNumber || null,

        panelSize:
          b.panelSize === null || b.panelSize === undefined || b.panelSize === ""
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
          ? (b.allowedCountries as string[]).map((x) => String(x))
          : [],

        api: !!b.api,
      },
    });

    // return the created record (UI uses .code to show “Supplier created” modal)
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    // handle unique constraint on code or name, etc.
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Unique constraint failed (duplicate value)." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Create failed", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}