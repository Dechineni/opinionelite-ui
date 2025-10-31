// src/app/api/logout/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const opts = { path: "/" };
  res.cookies.set("OE_AUTH", "", { ...opts, maxAge: 0 });
  res.cookies.set("OE_ROLE", "", { ...opts, maxAge: 0 });
  res.cookies.set("OE_NAME", "", { ...opts, maxAge: 0 });
  res.cookies.set("OE_EMAIL", "", { ...opts, maxAge: 0 });
  return res;
}