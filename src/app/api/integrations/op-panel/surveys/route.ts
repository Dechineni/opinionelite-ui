// FILE: src/app/api/integrations/op-panel/surveys/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "edge";

/**
 * ENV required in OpinionElite UI (Cloudflare):
 * OP_PANEL_CALLER_KEY=...               (OP Panel -> OpinionElite UI auth)
 * OP_PANEL_API_BASE=https://opinionelite.com
 * OP_PANEL_PROFILE_API_KEY=...          (OpinionElite UI -> OP Panel auth)
 * APP_PUBLIC_BASE_URL=https://opinion-elite.com   (fallback for supplierUrl if missing)
 */

function jsonError(msg: string, status = 400, extra?: any) {
  return NextResponse.json({ error: msg, ...(extra ?? {}) }, { status });
}

function unauthorized(msg = "Unauthorized") {
  return jsonError(msg, 401);
}

function readBearer(h: string | null | undefined) {
  const v = (h || "").trim();
  const m = v.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function getCallerKey(req: Request) {
  // Preferred
  const x = req.headers.get("x-op-panel-key");
  if (x && x.trim()) return x.trim();

  // Common alternates (helps with Postman tests)
  const x2 = req.headers.get("x-api-key");
  if (x2 && x2.trim()) return x2.trim();

  // As a fallback: Authorization Bearer <callerKey>
  const b = readBearer(req.headers.get("authorization"));
  if (b) return b;

  return "";
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = Number(String(val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function splitMulti(val: string): string[] {
  const v = val.trim();
  if (!v) return [];
  // JSON array support: ["A","B"]
  if (v.startsWith("[") && v.endsWith("]")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) {
        return arr.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      // fallthrough
    }
  }
  return v
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSupplierUrlFallback(opts: {
  baseUrl: string;
  projectCode: string;
  supplierCode: string;
  identifier: string;
}) {
  const u = new URL(`${opts.baseUrl.replace(/\/$/, "")}/Survey`);
  u.searchParams.set("projectId", opts.projectCode);
  u.searchParams.set("supplierId", opts.supplierCode);
  u.searchParams.set("id", opts.identifier);
  return u.toString();
}

export async function GET(req: Request) {
  // ---- Auth: OP Panel -> OpinionElite UI ----
  const callerKey = getCallerKey(req);
  const expectedCallerKey = (process.env.OP_PANEL_CALLER_KEY || "").trim();
  if (!expectedCallerKey || callerKey !== expectedCallerKey) {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const debug = (searchParams.get("debug") || "").trim() === "1";

  if (!userId) return jsonError("Missing userId", 400);

  const opPanelBase = (process.env.OP_PANEL_API_BASE || "").trim();
  const opPanelKey = (process.env.OP_PANEL_PROFILE_API_KEY || "").trim();
  if (!opPanelBase || !opPanelKey) {
    return jsonError("OP Panel API env not set", 500, {
      missing: {
        OP_PANEL_API_BASE: !opPanelBase,
        OP_PANEL_PROFILE_API_KEY: !opPanelKey,
      },
    });
  }

  // ---- 1) Fetch OP Panel profile answers (server-to-server) ----
  const profileUrl = new URL(
    `${opPanelBase.replace(/\/$/, "")}/UI/get_profile_answers.php`
  );
  profileUrl.searchParams.set("user_id", userId);

  const profRes = await fetch(profileUrl.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${opPanelKey}` },
    cache: "no-store",
  });

  if (!profRes.ok) {
    const txt = await profRes.text().catch(() => "");
    return jsonError("Failed to fetch OP Panel profile answers", 502, {
      detail: txt,
      statusFromOpPanel: profRes.status,
    });
  }

  const profJson = (await profRes.json()) as {
    answers?: Record<string, string>;
  };

  const answers = profJson?.answers || {};

  // ---- 2) Load supplier mappings for ACTIVE projects ----
  // IMPORTANT: do NOT filter allowTraffic yet (you said you haven't implemented it)
  const prisma = getPrisma();

  const maps = await prisma.projectSupplierMap.findMany({
    where: {
      project: { status: "ACTIVE" },
      // allowTraffic: true,  <-- removed on purpose
    },
    include: {
      supplier: { select: { code: true, name: true } },
      project: {
        select: {
          code: true,
          name: true,
          loi: true,
          prescreenQuestions: {
            select: {
              title: true,
              controlType: true,
              textMinLength: true,
              textMaxLength: true,
              options: {
                select: { label: true, value: true, enabled: true, validate: true },
              },
            },
          },
        },
      },
    },
  });

  const appBase =
    (process.env.APP_PUBLIC_BASE_URL || "").trim() || "https://opinion-elite.com";

  const eligible: Array<{
    surveyName: string;
    surveyLink: string;
    loi: number;
    rewards: number;
    projectCode: string;
    projectName: string;
    supplierName?: string;
  }> = [];

  const debugInfo: any[] = [];

  for (const m of maps as any[]) {
    const p = m.project;
    if (!p) continue;

    const projectCode = String(p.code || "");
    const projectName = String(p.name || "");
    const supplierCode = String(m.supplier?.code || "").trim();
    const supplierName = String(m.supplier?.name || "");
    const surveyName = `${projectCode} : ${projectName}`;

    const questions: any[] = Array.isArray(p.prescreenQuestions)
      ? p.prescreenQuestions
      : [];

    let ok = true;
    const reasons: any[] = [];

    for (const q of questions) {
      const controlType = String(q.controlType || "TEXT").toUpperCase();
      const titleKey = String(q.title || "").trim();
      if (!titleKey) continue;

      const userAnswerRaw = answers[titleKey];
      const userAnswer = userAnswerRaw == null ? "" : String(userAnswerRaw).trim();

      // Strict: missing answer => not eligible
      if (!userAnswer) {
        ok = false;
        reasons.push({ key: titleKey, reason: "missing_user_answer" });
        break;
      }

      // TEXT: numeric range check (min/max)
      if (controlType === "TEXT") {
        const min = Number(q.textMinLength || 0) || 0;
        const max = Number(q.textMaxLength || 0) || 0;

        if (min === 0 && max === 0) continue;

        const n = parseNumber(userAnswer);
        if (n == null) {
          ok = false;
          reasons.push({ key: titleKey, reason: "not_a_number", got: userAnswer });
          break;
        }
        if (min && n < min) {
          ok = false;
          reasons.push({ key: titleKey, reason: "below_min", min, got: n });
          break;
        }
        if (max && n > max) {
          ok = false;
          reasons.push({ key: titleKey, reason: "above_max", max, got: n });
          break;
        }
        continue;
      }

      // RADIO/CHECKBOX: validate against enabled options
      const opts: any[] = Array.isArray(q.options) ? q.options : [];

      // If any option has validate=true, treat "validate" as the selector (and must also be enabled).
      // Otherwise, fall back to enabled=true.
      const hasValidate = opts.some((o) => Boolean(o.validate));
      const allowed = new Set(
        opts
          .filter((o) => Boolean(o.enabled) && (hasValidate ? Boolean(o.validate) : true))
          .flatMap((o) => {
            const a: string[] = [];
            const lbl = String(o.label || "").trim();
            const val = String(o.value || "").trim();
            if (lbl) a.push(lbl);
            if (val) a.push(val);
            return a;
          })
          .filter(Boolean)
      );

      // If no enabled/validated options are configured, we cannot validate -> treat as pass
      if (allowed.size === 0) continue;

      if (controlType === "RADIO") {
        const v = userAnswer;
        if (!allowed.has(v)) {
          ok = false;
          reasons.push({
            key: titleKey,
            reason: "radio_no_match",
            got: v,
            allowed: Array.from(allowed),
          });
          break;
        }
      } else if (controlType === "CHECKBOX") {
        const picked = splitMulti(userAnswer);
        const anyMatch = picked.some((x) => allowed.has(x));
        if (!anyMatch) {
          ok = false;
          reasons.push({
            key: titleKey,
            reason: "checkbox_no_match",
            got: picked,
            allowed: Array.from(allowed),
          });
          break;
        }
      } else {
        // Unknown controlType -> don't fail the user
        continue;
      }
    }

    if (!ok) {
      if (debug) {
        debugInfo.push({
          projectCode,
          supplierCode,
          reasons,
        });
      }
      continue;
    }

    // Prefer stored supplierUrl; fallback build
    const storedUrl = String(m.supplierUrl || "").trim();
    const surveyLink =
      storedUrl ||
      buildSupplierUrlFallback({
        baseUrl: appBase,
        projectCode,
        supplierCode,
        identifier: userId,
      });

    eligible.push({
      surveyName,
      surveyLink,
      loi: Number(p.loi || 0) || 0,
      rewards: Number(m.cpi || 0) || 0,
      projectCode,
      projectName,
      supplierName,
    });
  }

  return NextResponse.json(
    debug ? { userId, items: eligible, debug: debugInfo } : { userId, items: eligible }
  );
}
