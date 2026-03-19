export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type NotifyEvent = "completion" | "terminate" | "quota" | "survey";
type Provider = string;

const looksLikePid = (s: string) => /^[0-9A-Za-z]{20}$/.test(s);

const ALLOWED_EVENTS = new Set<NotifyEvent>(["completion", "terminate", "quota", "survey"]);

function mapEventToOutcome(ev: NotifyEvent) {
  // Your internal DB enums:
  // RedirectResult: COMPLETE/TERMINATE/OVERQUOTA/QUALITYTERM/CLOSE
  // RedirectOutcome: COMPLETE/TERMINATE/OVER_QUOTA/DROP_OUT/QUALITY_TERM/SURVEY_CLOSE
  switch (ev) {
    case "completion":
      return { redirectResult: "COMPLETE" as const, eventOutcome: "COMPLETE" as const };
    case "terminate":
      return { redirectResult: "TERMINATE" as const, eventOutcome: "TERMINATE" as const };
    case "quota":
      return { redirectResult: "OVERQUOTA" as const, eventOutcome: "OVER_QUOTA" as const };
    case "survey":
    default:
      // “survey” notification usually means “routed / started”, not final status.
      // We won’t overwrite final result for this.
      return { redirectResult: null, eventOutcome: null };
  }
}

function readSecretHeader(req: Request): string {
  return (
    (req.headers.get("x-api-key") || "").trim() ||
    (req.headers.get("x-toluna-secret") || "").trim() ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
  );
}

/**
 * Provider-agnostic auth.
 * Configure provider secrets in Cloudflare env:
 *   NOTIFY_SECRET_TOLUNA=...
 *   NOTIFY_SECRET_OTHERPROVIDER=...
 *
 * If no secret configured for a provider, we allow (sandbox friendly).
 */
function verifyProviderSecret(provider: Provider, req: Request): boolean {
  const envKey = `NOTIFY_SECRET_${provider.toUpperCase()}`;
  const expected = (process.env as any)[envKey] ? String((process.env as any)[envKey]).trim() : "";
  if (!expected) return true;
  return readSecretHeader(req) === expected;
}

async function readBodyAny(req: Request): Promise<Record<string, any>> {
  // Collect query params too (some providers send GET or query-string)
  const u = new URL(req.url);
  const out: Record<string, any> = {};
  u.searchParams.forEach((v, k) => (out[k] = v));

  const ct = (req.headers.get("content-type") || "").toLowerCase();

  try {
    // JSON
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => null);
      if (j && typeof j === "object") Object.assign(out, j);
      return out;
    }

    // Read text for urlencoded OR "wrong content-type" JSON
    const text = await req.text().catch(() => "");
    if (!text) return out;

    // Try JSON anyway (some providers send JSON but wrong content-type)
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try {
        const j = JSON.parse(text);
        if (j && typeof j === "object") Object.assign(out, j);
        return out;
      } catch {
        // ignore, fallthrough
      }
    }

    // Try urlencoded
    const sp = new URLSearchParams(text);
    if ([...sp.keys()].length) {
      sp.forEach((v, k) => (out[k] = v));
      return out;
    }

    // fallback raw
    out["_raw"] = text;
    return out;
  } catch {
    return out;
  }
}

/**
 * Toluna MemberStatus notifications include AdditionalData which contains
 * the full querystring from invite URL (where rid=... is present).
 */
function extractRidFromAdditionalData(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";

  try {
    // full URL case
    if (s.startsWith("http://") || s.startsWith("https://")) {
      return (new URL(s).searchParams.get("rid") || "").trim();
    }

    // querystring case: "rid=...&SurveyID=..." or "?rid=..."
    const qs = s.startsWith("?") ? s.slice(1) : s;
    return (new URLSearchParams(qs).get("rid") || "").trim();
  } catch {
    // naive fallback
    const m = s.match(/(?:^|[?&])rid=([^&]+)/i);
    return m ? decodeURIComponent(m[1]) : "";
  }
}

/**
 * We want "rid" back. Providers may name it differently.
 * We'll check common options.
 */
function extractRid(payload: Record<string, any>): string {
  const keys = Object.keys(payload || {});
  const pick = (...cands: string[]) => {
    for (const c of cands) {
      const k = keys.find((kk) => kk.toLowerCase() === c.toLowerCase());
      if (k && payload[k] != null && String(payload[k]).trim() !== "") return String(payload[k]).trim();
    }
    return "";
  };

  // Prefer rid/pid in direct fields first
  const direct =
    pick("rid", "pid", "respondentId", "respondent_id", "externalId", "external_id") ||
    pick("RID", "Rid") ||
    "";

  if (direct) return direct;

  // Toluna-specific but safe for others: parse "AdditionalData"
  const fromAdditional = extractRidFromAdditionalData(payload.AdditionalData ?? payload.additionalData);
  if (fromAdditional) return fromAdditional;

  return "";
}

/**
 * Main entry: normalize notification into SurveyRedirect + SupplierRedirectEvent
 */
export async function handleProviderNotification(opts: {
  provider: Provider;
  event: NotifyEvent;
  req: Request;
}) {
  const { provider, event, req } = opts;

  // Event guard (protect core from misuse)
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
  }

  if (!verifyProviderSecret(provider, req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const payload = await readBodyAny(req);

  const ridIn = extractRid(payload);
  if (!ridIn) {
    // Return 200 so provider doesn't retry forever; log for your debugging
    console.error("[notify] missing rid", { provider, event, payload });
    return NextResponse.json({ ok: true, ignored: true, reason: "missing rid" });
  }

  // Resolve SurveyRedirect by pid OR by externalId
  const redirect = looksLikePid(ridIn)
    ? await prisma.surveyRedirect.findUnique({
        where: { id: ridIn },
        select: { id: true, projectId: true, supplierId: true, respondentId: true, externalId: true, result: true },
      })
    : await prisma.surveyRedirect.findFirst({
        where: { externalId: ridIn },
        orderBy: { createdAt: "desc" },
        select: { id: true, projectId: true, supplierId: true, respondentId: true, externalId: true, result: true },
      });

  if (!redirect) {
    console.warn("[notify] redirect not found", { provider, event, ridIn });
    return NextResponse.json({ ok: true, ignored: true, reason: "redirect not found" });
  }

  const mapped = mapEventToOutcome(event);

  // Only persist final outcomes for completion/terminate/quota
  if (mapped.redirectResult && mapped.eventOutcome) {
    // Update SurveyRedirect.result
    if (redirect.result !== mapped.redirectResult) {
      await prisma.surveyRedirect.update({
        where: { id: redirect.id },
        data: { result: mapped.redirectResult },
      });
    }

    // Resolve supplier id if supplierId is code (S1007) instead of cuid
    let supplierIdForEvent: string | null = null;
    if (redirect.supplierId) {
      const byId = await prisma.supplier.findUnique({ where: { id: redirect.supplierId }, select: { id: true } });
      if (byId) supplierIdForEvent = byId.id;
      if (!supplierIdForEvent) {
        const byCode = await prisma.supplier.findUnique({ where: { code: redirect.supplierId }, select: { id: true } });
        if (byCode) supplierIdForEvent = byCode.id;
      }
    }

    // Create SupplierRedirectEvent (best-effort; never throw to provider)
    await prisma.supplierRedirectEvent
      .create({
        data: {
          projectId: redirect.projectId,
          supplierId: supplierIdForEvent,
          respondentId: redirect.respondentId ?? null,
          pid: redirect.id,
          outcome: mapped.eventOutcome as any,
        },
      })
      .catch((e) => {
        // keep provider response OK, but log for debugging
        console.warn("[notify] supplierRedirectEvent insert failed", {
          provider,
          event,
          pid: redirect.id,
          error: String(e?.message || e),
        });
      });
  }

  return NextResponse.json({
    ok: true,
    provider,
    event,
    pid: redirect.id,
    persisted: Boolean(mapped.redirectResult),
  });
}