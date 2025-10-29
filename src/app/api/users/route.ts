// src/app/api/users/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function ensureAdmin() {
  const jar = await cookies();                 // ✅ await in Next 15
  const role = jar.get("OE_ROLE")?.value;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const forbid = await ensureAdmin();          // ✅ await the check
  if (forbid) return forbid;

  // ...fetch & return users...
  return NextResponse.json([]);
}

export async function POST(req: Request) {
  const forbid = await ensureAdmin();          // ✅ await the check
  if (forbid) return forbid;

  const body = await req.json();
  // ...create user...
  return NextResponse.json({ ok: true }, { status: 201 });
}