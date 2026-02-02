// FILE: src/app/api/integrations/op-panel/surveys/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "edge";

/**
 * ENV required in OpinionElite UI (Cloudflare):
 * OP_PANEL_CALLER_KEY=...              (OP Panel -> OpinionElite UI auth)
 * OP_PANEL_API_BASE=https://opinionelite.com
 * OP_PANEL_PROFILE_API_KEY=...         (OpinionElite UI -> OP Panel auth)
 * APP_PUBLIC_BASE_URL=https://opinion-elite.com   (fallback to build supplierUrl if missing)
 */

function unauthorized(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = Number(String(val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// For CHECKBOX answers coming as "A,B,C" or JSON-ish etc.
function splitMulti(val: string): string[] {
  const v = val.trim();
  if (!v) return [];
  // Try JSON array first
  if (v.startsWith("[") && v.endsWith("]")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr))
        return arr.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {}
  }
  // Fallback comma/newline separated
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

/**
 * Replace common placeholders in stored supplierUrl
 * Examples supported:
 *  - [identifier]
 *  - [id]
 *  - {identifier}
 *  - {id}
 *  - __IDENTIFIER__
 */
function applyIdentifier(url: string, userId: string) {
  const safe = String(url || "").trim();
  if (!safe) return safe;

  return safe
    .replaceAll("[identifier]", userId)
    .replaceAll("[id]", userId)
    .replaceAll("{identifier}", userId)
    .replaceAll("{id}", userId)
    .replaceAll("__IDENTIFIER__", userId);
}

export async function GET(req: Request) {
  // ---- Auth: OP Panel -> OpinionElite UI ----
  const callerKey = req.headers.get("x-op-panel-key") || "";
  if (!process.env.OP_PANEL_CALLER_KEY || callerKey !== process.env.OP_PANEL_CALLER_KEY) {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  // Accept both userId and userid
  const userId =
    (searchParams.get("userId") || searchParams.get("userid") || "").trim();

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
    headers: {
      // send both to avoid server env quirks
      Authorization: `Bearer ${opPanelKey}`,
      "X-Api-Key": opPanelKey,
    },
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

  // ---- 2) Load ALL supplier mappings for ACTIVE projects that allow traffic ----
  const prisma = getPrisma();
  const maps = await prisma.projectSupplierMap.findMany({
    where: {
      allowTraffic: true,
      project: { status: "ACTIVE" },
    },
    include: {
      supplier: { select: { id: true, code: true, name: true } },
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
              options: { select: { label: true, value: true, enabled: true, validate: true } },
            },
          },
        },
      },
    },
  });

  const appBase = (process.env.APP_PUBLIC_BASE_URL || "").trim() || "https://opinion-elite.com";

  const eligible: Array<{
    mapId: string;
    supplierId: string;
    supplierCode: string;
    supplierName: string;
    surveyName: string;
    surveyLink: string;
    loi: number;
    rewards: number;
    projectCode: string;
    projectName: string;
  }> = [];

  for (const m of maps as any[]) {
    const p = m.project;
    if (!p) continue;

    const questions: any[] = Array.isArray(p.prescreenQuestions) ? p.prescreenQuestions : [];
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

        // if no range configured, skip validation
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

        // Only validate if any option has validate=true
        const hasValidate = opts.some((o) => Boolean(o.validate));
        if (!hasValidate) continue;

        // Allowed options = enabled + validate
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
    const supplierName = String(m.supplier?.name || "").trim();

    // Prefer stored supplierUrl (persisted in ProjectSupplierMap)
    const storedUrlRaw = String(m.supplierUrl || "").trim();
    const storedUrl = applyIdentifier(storedUrlRaw, userId);

    const surveyLink =
      storedUrl ||
      buildSupplierUrlFallback({
        baseUrl: appBase,
        projectCode,
        supplierCode,
        identifier: userId,
      });

    eligible.push({
      mapId: String(m.id),
      supplierId: String(m.supplierId || ""),
      supplierCode,
      supplierName,
      surveyName,
      surveyLink,
      loi: Number(p.loi || 0) || 0,      // from Project
      rewards: Number(m.cpi || 0) || 0,  // from ProjectSupplierMap CPI
      projectCode,
      projectName,
    });
  }

  return NextResponse.json({ userId, items: eligible });
}
