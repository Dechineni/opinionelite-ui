// FILE: src/app/api/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

type DemoUser = {
  email?: string;
  pass?: string;
  role: "admin" | "manager";
  name: string;
};

function getDemoUsers(): DemoUser[] {
  return [
    {
      email: process.env.DEMO_ADMIN_EMAIL,
      pass: process.env.DEMO_ADMIN_PASS,
      role: "admin",
      name: "Admin Demo",
    },
    {
      email: process.env.DEMO_MANAGER_EMAIL,
      pass: process.env.DEMO_MANAGER_PASS,
      role: "manager",
      name: "Manager Demo",
    },
  ].filter((u) => !!u.email && !!u.pass) as DemoUser[];
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const match = getDemoUsers().find(
    (u) =>
      u.email?.toLowerCase() === String(email).toLowerCase() &&
      u.pass === password
  );

  if (!match) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // --- cookie options ---
  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const base = {
    path: "/",
    sameSite: "lax" as const,
    secure: isProd, // must be true when served over HTTPS
    maxAge,
  };

  // You could store a signed/JWT token here; for demo a random token is OK.
  const token = crypto.randomBytes(24).toString("hex");

  const res = NextResponse.json({ ok: true, role: match.role });

  // Auth token — httpOnly
  res.cookies.set("OE_AUTH", token, {
    ...base,
    httpOnly: true,
  });

  // These don’t need to be readable by JS because you already read them
  // on the server (via `cookies()` in layouts/middleware) and pass to the client.
  // Making them httpOnly reduces tampering risk.
  res.cookies.set("OE_ROLE", match.role, { ...base, httpOnly: true });
  res.cookies.set("OE_NAME", match.name, { ...base, httpOnly: true });
  res.cookies.set("OE_EMAIL", match.email!, { ...base, httpOnly: true });

  return res;
}