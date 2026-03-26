export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";

function normalizeAuth(aRaw: string | null | undefined) {
  const a = (aRaw || "").toLowerCase().trim();

  if (a === "c" || a === "10") return "COMPLETE";
  if (a === "t" || a === "20") return "TERMINATE";
  if (a === "q" || a === "40") return "OVERQUOTA";
  if (a === "f" || a === "30") return "QUALITYTERM";
  if (a === "sc" || a === "70") return "CLOSE";

  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const auth = url.searchParams.get("auth");
    const rid = (url.searchParams.get("rid") || "").trim();

    const status = normalizeAuth(auth);

    if (!status) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing auth" },
        { status: 400 }
      );
    }

    if (!rid) {
      return NextResponse.json(
        { ok: false, error: "Missing rid" },
        { status: 400 }
      );
    }

    const opPanelBase =
      (process.env.OP_PANEL_API_BASE || "").trim() || "https://opinionelite.com";

    const completeUrl = new URL(
      "/UI/complete.php",
      opPanelBase.replace(/\/$/, "") + "/"
    );

    // Temporary passthrough params for traceability.
    // rid is currently supplier id in your flow.
    completeUrl.searchParams.set("auth", auth || "");
    completeUrl.searchParams.set("rid", rid);
    completeUrl.searchParams.set("status", status);
    completeUrl.searchParams.set("source", "thanks-verify");

    return NextResponse.redirect(completeUrl.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server error" },
      { status: 500 }
    );
  }
}