// FILE: src/app/api/client/[id]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// Adjust this to exactly the columns you store on Client.
// Keeping it explicit prevents accidental large reads.
const CLIENT_SELECT = {
  id: true,
  code: true,
  name: true,
  contactPerson: true,
  email: true,
  contactNumber: true,
  countryCode: true,
  website: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Build a `where` that can target by id (default) or by code (?by=code)
function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

// Small helper: drop undefined keys so Prisma validates less
function clean<T extends Record<string, any>>(o: T): Partial<T> {
  const out = {} as Partial<T>;
  for (const k in o) {
    const v = (o as any)[k];
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

/* ------------------------------- GET /:id ------------------------------- */
// GET /api/client/:id
// GET /api/client/:code?by=code
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);

  try {
    // findUnique with tight select (fast + small payload)
    const item = await prisma.client.findUnique({ where, select: CLIENT_SELECT });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: "Fetch failed", detail: String(e) }, { status: 400 });
  }
}

/* ------------------------------ PATCH /:id ------------------------------ */
// PATCH /api/client/:id
// PATCH /api/client/:code?by=code
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);
  const b = await req.json();

  // Build a minimal data object; `clean` removes undefined keys
  const data = clean({
    code: b.code,                              // allow changing client code (if unique)
    name: b.name ?? b.clientName,
    contactPerson: b.contactPerson,
    email: b.email,
    contactNumber: b.contactNumber,
    countryCode: b.countryCode ?? b.country,
    website: b.website,
  });

  try {
    const updated = await prisma.client.update({
      where,
      data,
      select: CLIENT_SELECT,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Update failed", detail: String(e) }, { status: 400 });
  }
}

/* ----------------------------- DELETE /:id ------------------------------ */
// DELETE /api/client/:id
// DELETE /api/client/:code?by=code
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();
  const { id } = await ctx.params;
  const where = whereFrom(req, id);

  try {
    await prisma.client.delete({ where });
    // 204 keeps the payload empty (slightly cheaper)
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Delete failed", detail: String(e) }, { status: 400 });
  }
}