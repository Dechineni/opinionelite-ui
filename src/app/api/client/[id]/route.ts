// FILE: src/app/api/client/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Build a `where` that can target by id (default) or by code (?by=code)
function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

/* ------------------------------- GET /:id ------------------------------- */
// GET /api/client/:id
// GET /api/client/:code?by=code
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const where = whereFrom(req, params.id);

  const item = await prisma.client.findUnique({ where });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(item);
}

/* ------------------------------ PATCH /:id ------------------------------ */
// PATCH /api/client/:id          (JSON body with fields to update)
// PATCH /api/client/:code?by=code
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const where = whereFrom(req, params.id);
  const b = await req.json();

  // Map incoming fields -> Prisma update input (undefined fields are ignored)
  const data: Prisma.ClientUpdateInput = {
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
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const where = whereFrom(req, params.id);

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