// FILE: src/app/api/thanks/index/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = url.searchParams.get("auth");
  const rid  = url.searchParams.get("rid");

  if (!auth || !rid) {
    return NextResponse.json({ ok: false, error: "Missing auth or rid" }, { status: 400 });
  }

  // Mirror to the canonical handler that does all the work
  const target = new URL("/Thanks/Index", url.origin);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v)); // pass through any extra params

  return NextResponse.redirect(target, { status: 302 });
}