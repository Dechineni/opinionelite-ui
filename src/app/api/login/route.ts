// FILE: src/app/api/login/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Helper to make a hex token using Web Crypto (Edge-safe)
function randomHex(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

type DemoUser = {
  email?: string;
  pass?: string;
  role: "admin" | "manager";
  name: string;
};

function getDemoUsers(): DemoUser[] {
  return [
    { email: process.env.DEMO_ADMIN_EMAIL,   pass: process.env.DEMO_ADMIN_PASS,   role: "admin",   name: "Admin Demo"   },
    { email: process.env.DEMO_MANAGER_EMAIL, pass: process.env.DEMO_MANAGER_PASS, role: "manager", name: "Manager Demo" },
  ].filter(u => !!u.email && !!u.pass) as DemoUser[];
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const match = getDemoUsers().find(
    (u) => u.email?.toLowerCase() === String(email).toLowerCase() && u.pass === password
  );

  if (!match) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const maxAge = 60 * 60 * 24 * 7;
  const base = { path: "/", sameSite: "lax" as const, secure: isProd, maxAge };

  // ✅ Edge-safe random token
  const token = randomHex(24);

  const res = NextResponse.json({ ok: true, role: match.role });

  res.cookies.set("OE_AUTH", token, { ...base, httpOnly: true });
  res.cookies.set("OE_ROLE", match.role, { ...base, httpOnly: true });
  res.cookies.set("OE_NAME", match.name, { ...base, httpOnly: true });
  res.cookies.set("OE_EMAIL", match.email!, { ...base, httpOnly: true });

  return res;
}