// FILE: src/app/api/integrations/op-panel/surveys/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { COUNTRIES } from "@/data/countries";

export const runtime = "edge";

/**
 * ENV required in OpinionElite UI (Cloudflare):
 * OP_PANEL_CALLER_KEY=...                   (OP Panel -> OpinionElite UI auth)
 * OP_PANEL_API_BASE=https://opinionelite.com
 * OP_PANEL_PROFILE_API_KEY=...              (OpinionElite UI -> OP Panel auth)
 * APP_PUBLIC_BASE_URL=https://opinion-elite.com   (fallback to build supplierUrl if missing)
 */

function normalizeCountryName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove accents
}

const COUNTRY_NAME_TO_CODE = new Map(
  COUNTRIES.map((c) => [normalizeCountryName(c.name), c.code.toUpperCase()])
);

function toCountryCodeFromName(nameOrCode: string | null | undefined): string {
  const v = String(nameOrCode ?? "").trim();
  if (!v) return "";

  // if user already has code like "IN"
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();

  const key = normalizeCountryName(v);
  return COUNTRY_NAME_TO_CODE.get(key) || "";
}

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

function normText(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function computeAgeYears(birthday: string | null | undefined, now = new Date()): number | null {
  if (!birthday) return null;
  // Expected formats in OP Panel signup: 'YYYY-MM-DD' (stored as varchar)
  const s = String(birthday).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dob = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dob.getTime())) return null;
  const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let age = nowUTC.getUTCFullYear() - dob.getUTCFullYear();
  const mDiff = nowUTC.getUTCMonth() - dob.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && nowUTC.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 125) return null;
  return age;
}

function parseAgeRange(label: string): { min: number; max: number } | null {
  const t = String(label || "").trim();
  // Typical: "31-40" or "21 - 30"
  const m = t.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min < 0 || max > 125) return null;
  return { min, max };
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
  return url
    .replaceAll("[identifier]", encodeURIComponent(userId))
    .replaceAll("{identifier}", encodeURIComponent(userId));
}

export async function GET(req: Request) {
  // ---- Auth: OP Panel -> OpinionElite UI ----
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

  // ---- 1) Fetch OP Panel answers + signup info (Option B) ----
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

  const profJson = (await profRes.json()) as {
    answers?: Record<string, string>;
    signup?: { country?: string | null; birthday?: string | null; zipcode?: string | null };
  };
  const answers = profJson?.answers || {};
  const signupCountry = profJson?.signup?.country ?? null;
  const signupBirthday = profJson?.signup?.birthday ?? null;

  // ---- 2) Load supplier mappings for ACTIVE projects ----
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
          countryCode: true,
          loi: true,
          prescreenQuestions: {
            select: {
              title: true,
              question: true,
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
    if (questions.length === 0) continue; // existing rule

    // ---- (1) Country eligibility ----
    const projectCountryCode = String(p.countryCode ?? "").toUpperCase();
if (projectCountryCode) {
  const userCountryCode = toCountryCodeFromName(signupCountry);
  if (!userCountryCode || userCountryCode !== projectCountryCode) continue;
}

    // ---- (2) Age eligibility (conditional) ----
    const ageQ = questions.find((q) => {
      const qText = normText(q?.question);
      const isAgeText = qText === normText("What is your age?") || qText.includes("your age");
      return isAgeText && String(q?.controlType || "").toUpperCase() === "RADIO";
    });

    if (ageQ) {
      const opts: any[] = Array.isArray(ageQ.options) ? ageQ.options : [];
      const validated = opts.filter((o) => Boolean(o.enabled) && Boolean(o.validate));
      if (validated.length > 0) {
        const age = computeAgeYears(signupBirthday);
        if (age == null) continue;

        const ranges = validated
          .map((o) => parseAgeRange(String(o.label || o.value || "")))
          .filter(Boolean) as Array<{ min: number; max: number }>;

        if (ranges.length === 0) continue;
        const inAny = ranges.some((r) => age >= r.min && age <= r.max);
        if (!inAny) continue;
      }
    }

    // ---- (3) Prescreen answer matching (existing) ----
    let ok = true;

    for (const q of questions) {
      const controlType = String(q.controlType || "TEXT");
      const titleKey = String(q.title || "").trim();
      if (!titleKey) continue;

      // Skip age question here (validated via signup birthday)
      const qText = normText(q?.question);
      if (qText === normText("What is your age?") || qText.includes("your age")) continue;

      const userAnswer = answers[titleKey];
      if (userAnswer == null || String(userAnswer).trim() === "") {
        ok = false;
        break;
      }

      if (controlType === "TEXT") {
        const min = Number(q.textMinLength || 0) || 0;
        const max = Number(q.textMaxLength || 0) || 0;
        if (min === 0 && max === 0) continue;

        const n = parseNumber(userAnswer);
        if (n == null) { ok = false; break; }
        if (min && n < min) { ok = false; break; }
        if (max && n > max) { ok = false; break; }
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
          if (!allowed.has(v)) { ok = false; break; }
        } else if (controlType === "CHECKBOX") {
          const picked = splitMulti(String(userAnswer));
          const anyMatch = picked.some((x) => allowed.has(x));
          if (!anyMatch) { ok = false; break; }
        }
      }
    }

    if (!ok) continue;

    const projectCode = String(p.code || "");
    const projectName = String(p.name || "");
    const surveyName = `${projectCode} : ${projectName}`;

    const supplierCode = String(m.supplier?.code || "").trim();

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
