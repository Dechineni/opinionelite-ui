// FILE: src/app/api/client/[id]/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

// Build a `where` that can target by id (default) or by code (?by=code)
function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

/* ------------------------------- GET /:id ------------------------------- */
// GET /api/client/:id
// GET /api/client/:code?by=code
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // ⬅️ params is a Promise in Next 15
) {
  const { id } = await ctx.params;          // ⬅️ await it
  const where = whereFrom(req, id);

  const item = await prisma.client.findUnique({ where });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(item);
}

/* ------------------------------ PATCH /:id ------------------------------ */
// PATCH /api/client/:id
// PATCH /api/client/:code?by=code
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;          // ⬅️ await it
  const where = whereFrom(req, id);
  const b = await req.json();

  // Build data without importing Prisma types (avoids the Prisma import error)
  const data: any = {
    code: b.code, // optional: allow changing client code
    name: b.name ?? b.clientName,
    contactPerson: b.contactPerson,
    email: b.email,
    contactNumber: b.contactNumber,
    countryCode: b.countryCode ?? b.country,
    website: b.website,
  };

  try {
    const updated = await prisma.client.update({ where, data });
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
  const { id } = await ctx.params;          // ⬅️ await it
  const where = whereFrom(req, id);

  try {
    await prisma.client.delete({ where });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Delete failed", detail: String(e) }, { status: 400 });
  }
}