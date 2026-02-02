// FILE: src/app/api/integrations/op-panel/surveys/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "edge";

/**
 * ENV required in OpinionElite UI (Cloudflare):
 * OP_PANEL_CALLER_KEY=...                   (OP Panel -> OpinionElite UI auth)
 * OP_PANEL_API_BASE=https://opinionelite.com
 * OP_PANEL_PROFILE_API_KEY=...              (OpinionElite UI -> OP Panel auth)
 * APP_PUBLIC_BASE_URL=https://opinion-elite.com   (fallback to build supplierUrl if missing)
 */

function unauthorized(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function parseBearer(authHeader: string | null) {
  if (!authHeader) return "";
  const m = authHeader.match(/Bearer\s+(.+)/i);
  return m ? String(m[1]).trim() : "";
}

function splitMulti(val: string): string[] {
  const v = val.trim();
  if (!v) return [];
  if (v.startsWith("[") && v.endsWith("]")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr))
        return arr.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {}
  }
  return v
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = Number(String(val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
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

function applyIdentifier(url: string, userId: string) {
  if (!url) return url;
  // Replace common placeholders used in your UI
  return url
    .replaceAll("[identifier]", encodeURIComponent(userId))
    .replaceAll("{identifier}", encodeURIComponent(userId));
}

export async function GET(req: Request) {
  // ---- Auth: OP Panel -> OpinionElite UI ----
  // Accept any of these:
  //  - x-op-panel-key: <key>
  //  - x-api-key: <key>
  //  - Authorization: Bearer <key>
  const expectedCallerKey = (process.env.OP_PANEL_CALLER_KEY || "").trim();
  const headerKey =
    (req.headers.get("x-op-panel-key") || "").trim() ||
    (req.headers.get("x-api-key") || "").trim() ||
    parseBearer(req.headers.get("authorization"));

  if (!expectedCallerKey || headerKey !== expectedCallerKey) {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const opPanelBase = (process.env.OP_PANEL_API_BASE || "").trim();
  const opPanelKey = (process.env.OP_PANEL_PROFILE_API_KEY || "").trim();
  if (!opPanelBase || !opPanelKey) {
    return NextResponse.json({ error: "OP Panel API env not set" }, { status: 500 });
  }

  // ---- 1) Fetch OP Panel profile answers (server-to-server) ----
  const profileUrl = new URL(`${opPanelBase.replace(/\/$/, "")}/UI/get_profile_answers.php`);
  profileUrl.searchParams.set("user_id", userId);

  const profRes = await fetch(profileUrl.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${opPanelKey}` },
    cache: "no-store",
  });

  if (!profRes.ok) {
    const txt = await profRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to fetch OP Panel profile answers", detail: txt },
      { status: 502 }
    );
  }

  const profJson = (await profRes.json()) as { answers?: Record<string, string> };
  const answers = profJson?.answers || {};

  // ---- 2) Load supplier mappings for ACTIVE projects ----
  // IMPORTANT:
  // - Do NOT filter by allowTraffic (you said it's not implemented yet)
  // - We will SKIP projects that have ZERO prescreenQuestions
  const prisma = getPrisma();
  const maps = await prisma.projectSupplierMap.findMany({
    where: {
      project: { status: "ACTIVE" },
    },
    include: {
      supplier: { select: { code: true, name: true } },
      project: {
        select: {
          code: true,
          name: true,
          loi: true, // from Project
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
    orderBy: { createdAt: "asc" },
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

  for (const m of maps as any[]) {
    const p = m.project;
    if (!p) continue;

    const questions: any[] = Array.isArray(p.prescreenQuestions) ? p.prescreenQuestions : [];

    // ✅ Your requirement:
    // If a project has NO prescreen questions configured, do not return it for OP Panel.
    if (questions.length === 0) {
      continue;
    }

    let ok = true;

    for (const q of questions) {
      const controlType = String(q.controlType || "TEXT");
      const titleKey = String(q.title || "").trim();
      if (!titleKey) continue;

      const userAnswer = answers[titleKey];

      // strict: missing answer => not eligible
      if (userAnswer == null || String(userAnswer).trim() === "") {
        ok = false;
        break;
      }

      if (controlType === "TEXT") {
        const min = Number(q.textMinLength || 0) || 0;
        const max = Number(q.textMaxLength || 0) || 0;

        // If no min/max constraints, accept as present
        if (min === 0 && max === 0) continue;

        const n = parseNumber(userAnswer);
        if (n == null) {
          ok = false;
          break;
        }
        if (min && n < min) {
          ok = false;
          break;
        }
        if (max && n > max) {
          ok = false;
          break;
        }
      } else {
        const opts: any[] = Array.isArray(q.options) ? q.options : [];

        // Only validate options if ANY option is marked validate=true
        const hasValidate = opts.some((o) => Boolean(o.validate));
        if (!hasValidate) {
          // If validate flags aren't being saved yet, we still consider "answer present" as pass.
          continue;
        }

        const allowed = new Set(
          opts
            .filter((o) => Boolean(o.enabled) && Boolean(o.validate))
            .map((o) => String(o.label || o.value || "").trim())
            .filter(Boolean)
        );

        if (allowed.size === 0) continue;

        if (controlType === "RADIO") {
          const v = String(userAnswer).trim();
          if (!allowed.has(v)) {
            ok = false;
            break;
          }
        } else if (controlType === "CHECKBOX") {
          const picked = splitMulti(String(userAnswer));
          const anyMatch = picked.some((x) => allowed.has(x));
          if (!anyMatch) {
            ok = false;
            break;
          }
        }
      }
    }

    if (!ok) continue;

    const projectCode = String(p.code || "");
    const projectName = String(p.name || "");
    const surveyName = `${projectCode} : ${projectName}`;

    const supplierCode = String(m.supplier?.code || "").trim();

    // Prefer stored supplierUrl if present, but ensure identifier is filled
    const storedUrlRaw = String(m.supplierUrl || "").trim();
    const storedUrl = storedUrlRaw ? applyIdentifier(storedUrlRaw, userId) : "";

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
      supplierName: String(m.supplier?.name || ""),
    });
  }

  return NextResponse.json({ userId, items: eligible });
}
