export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { handleProviderNotification } from "../../_core";

const ALLOWED_EVENTS = new Set(["completion", "terminate", "quota", "survey"]);

export async function POST(req: Request, ctx: { params: { provider: string; event: string } }) {
  const provider = String(ctx.params.provider || "").trim();
  const eventRaw = String(ctx.params.event || "").trim().toLowerCase();

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Missing provider" }, { status: 400 });
  }
  if (!ALLOWED_EVENTS.has(eventRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
  }

  return handleProviderNotification({ provider, event: eventRaw as any, req });
}

export async function GET(req: Request, ctx: { params: { provider: string; event: string } }) {
  const provider = String(ctx.params.provider || "").trim();
  const eventRaw = String(ctx.params.event || "").trim().toLowerCase();

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Missing provider" }, { status: 400 });
  }
  if (!ALLOWED_EVENTS.has(eventRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
  }

  return handleProviderNotification({ provider, event: eventRaw as any, req });
}