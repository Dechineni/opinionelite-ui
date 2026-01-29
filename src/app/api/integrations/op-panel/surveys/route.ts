// src/app/api/integrations/op-panel/surveys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "edge";

/**
 * ENV required in OpinionElite UI (Cloudflare):
 * OP_PANEL_CALLER_KEY=...               (OP Panel -> OpinionElite UI auth)
 * OP_PANEL_API_BASE=https://opinionelite.com
 * OP_PANEL_PROFILE_API_KEY=...          (OpinionElite UI -> OP Panel auth)
 * OP_PANEL_SUPPLIER_ID=S1002            (the supplierId that represents OP Panel in OpinionElite)
 * APP_PUBLIC_BASE_URL=https://opinion-elite.com
 */

function unauthorized(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = Number(String(val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function splitMulti(val: string): string[] {
  const v = val.trim();
  if (!v) return [];
  if (v.startsWith("[") && v.endsWith("]")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {}
  }
  return v
    .split(/[,|\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSurveyLink(opts: {
  baseUrl: string;
  projectCode: string;
  supplierId: string;
  redirectionType: string;
  identifier: string;
}) {
  const { baseUrl, projectCode, supplierId, redirectionType, identifier } = opts;
  const u = new URL(`${baseUrl.replace(/\/$/, "")}/Survey`);
  u.searchParams.set("projectId", projectCode);
  u.searchParams.set("supplierId", supplierId);
  u.searchParams.set("rType", redirectionType || "static");
  u.searchParams.set("id", identifier);
  return u.toString();
}

async function handleRequest(req: Request, userId: string) {
  // ---- Auth: OP Panel -> OpinionElite UI ----
  const callerKey = req.headers.get("x-op-panel-key") || "";
  if (!process.env.OP_PANEL_CALLER_KEY || callerKey !== process.env.OP_PANEL_CALLER_KEY) {
    return unauthorized();
  }

  userId = (userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const supplierId = (process.env.OP_PANEL_SUPPLIER_ID || "").trim();
  if (!supplierId) {
    return NextResponse.json({ error: "OP_PANEL_SUPPLIER_ID not set" }, { status: 500 });
  }

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

  // ---- 2) Load active supplier mappings for OP Panel supplier ----
  const maps = await prisma.projectSupplierMap.findMany({
    where: {
      supplierId,
      project: { status: "ACTIVE" },
    },
    include: {
      project: {
        include: {
          prescreenQuestions: {
            include: { options: true },
          },
        },
      },
    },
  });

  const appBase = (process.env.APP_PUBLIC_BASE_URL || "").trim() || "https://opinion-elite.com";

  // ---- 3) Eligibility evaluation ----
  const eligible: Array<{
    surveyName: string;
    surveyLink: string;
    loi: number;
    rewards: number;
    projectCode: string;
    projectName: string;
  }> = [];

  for (const m of maps) {
    const p: any = m.project;
    if (!p) continue;

    const questions: any[] = Array.isArray(p.prescreenQuestions) ? p.prescreenQuestions : [];

    let ok = true;

    for (const q of questions) {
      const controlType = String(q.controlType || "TEXT");
      const titleKey = String(q.title || "").trim();
      if (!titleKey) continue;

      const userAnswer = answers[titleKey];

      // Strict: missing answer => not eligible
      if (userAnswer == null || String(userAnswer).trim() === "") {
        ok = false;
        break;
      }

      if (controlType === "TEXT") {
        const min = Number(q.textMinLength || 0) || 0;
        const max = Number(q.textMaxLength || 0) || 0;

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

        const hasValidate = opts.some((o) => Boolean(o.validate));
        if (!hasValidate) continue;

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

    const surveyLink = buildSurveyLink({
      baseUrl: appBase,
      projectCode,
      supplierId,
      redirectionType: String(m.redirectionType || "static"),
      identifier: userId,
    });

    eligible.push({
      surveyName,
      surveyLink,
      loi: Number((p as any).loi || 0) || 0,
      rewards: Number((m as any).cpi || 0) || 0,
      projectCode,
      projectName,
    });
  }

  return NextResponse.json({ userId, supplierId, items: eligible });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  return handleRequest(req, userId);
}

// OPTIONAL (not required): allow POST { userId: "Adam" }
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const userId = String(body?.userId || "").trim();
  return handleRequest(req, userId);
}
