export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/** Generate a 20-char URL-safe id (Edge-safe, no deps) */
function id20() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Replace tokens like [identifier], [projectId], [supplierId], [pid] */
function replaceTokens(template: string, map: Record<string, string>) {
  return template.replace(/\[([^\]]+)\]/g, (_, k) => map[k] ?? "");
}

/** Simple scheme whitelist */
function isAllowedScheme(u: URL) {
  return u.protocol === "http:" || u.protocol === "https:";
}

/* ----------------------- ultra-light memory cache ----------------------- */
/** Per-isolate cache so we can survive brief DB blips without stalling */
type CacheEntry = { v: string; exp: number };
type MemCache = Map<string, CacheEntry>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = globalThis as any;
const MEM_TTL_MS = 5 * 60 * 1000; // 5 min
const mem: MemCache = (G.__surveyLiveCache ??= new Map<string, CacheEntry>());

function memGet(k: string): string | null {
  const e = mem.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) {
    mem.delete(k);
    return null;
  }
  return e.v;
}
function memPut(k: string, v: string) {
  mem.set(k, { v, exp: Date.now() + MEM_TTL_MS });
}

/** Resolve project by id or code with only what we need (with timeout) */
async function loadProjectBasicsWithTimeout(
  prisma: ReturnType<typeof getPrisma>,
  key: string,
  ms = 1500
) {
  return Promise.race([
    prisma.project.findFirst({
      where: { OR: [{ id: key }, { code: key }] },
      select: { id: true, surveyLiveUrl: true },
    }),
    new Promise<null>((_, rej) => setTimeout(() => rej(new Error("db-timeout")), ms)),
  ]) as Promise<{ id: string; surveyLiveUrl: string | null } | null>;
}

/** Env flag: set REDIRECT_LOG="off" to skip DB log writes */
const LOG_REDIRECT = (process.env.REDIRECT_LOG || "on").toLowerCase() !== "off";

/** Helper: best-effort write that never throws up the stack in HTTP mode */
async function safeLogRedirect(prisma: ReturnType<typeof getPrisma>, data: {
  id: string;
  projectId: string;
  supplierId: string | null;
  externalId: string | null;
  destination: string;
}) {
  if (!LOG_REDIRECT) return;
  try {
    await prisma.surveyRedirect.upsert({
      where: { id: data.id },
      update: { destination: data.destination },
      create: {
        id: data.id,
        projectId: data.projectId,
        supplierId: data.supplierId,
        externalId: data.externalId,
        destination: data.destination,
      },
    });
  } catch (_e) {
    // Never block user flow because of a logging failure in HTTP mode
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = (url.searchParams.get("supplierId") || "").trim() || null;
  const identifier = (url.searchParams.get("id") || "").trim(); // supplier’s respondent id

  if (!identifier) {
    return NextResponse.json({ error: "Missing id (supplier respondent identifier)." }, { status: 400 });
  }

  // ---------------- 1) Resolve project + live URL (with cache/timeout) ----------------
  let projectIdReal = projectId; // normalize to DB id when we resolve it
  let template = memGet(`live:${projectId}`) ?? "";
  let haveRealId = false;

  if (!template) {
    try {
      const project = await loadProjectBasicsWithTimeout(prisma, projectId);
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      projectIdReal = project.id;
      haveRealId = true;
      template = (project.surveyLiveUrl || "").trim();
      if (!template) {
        return NextResponse.json(
          { error: "Live survey URL is not configured for this project." },
          { status: 400 }
        );
      }
      memPut(`live:${projectId}`, template);
      memPut(`live:${project.id}`, template);
    } catch (e: any) {
      const msg = e?.message === "db-timeout"
        ? "Database timeout while resolving survey link."
        : "Failed to resolve project survey link.";
      return NextResponse.json({ error: msg }, { status: 504 });
    }
  } else {
    // We still want the real DB id if projectId was a code; fetch cheaply
    try {
      const p = await prisma.project.findFirst({
        where: { OR: [{ id: projectId }, { code: projectId }] },
        select: { id: true },
      });
      if (p?.id) {
        projectIdReal = p.id;
        haveRealId = true;
      }
    } catch {
      /* ignore — we’ll proceed with the path value */
    }
  }

  // ---------------- 2) PRESCREEN GATE (reads only; no transactions) ----------------
  try {
    // Count questions for this project.
    const totalQuestions = await prisma.prescreenQuestion.count({
      where: { projectId: projectIdReal },
    });

    if (totalQuestions > 0) {
      // Ensure/resolve respondent WITHOUT any transactions.
      // NULL cannot be used in composite upserts → follow the two-path approach.
      let respondentId: string | null = null;

      if (supplierId === null) {
        const existing = await prisma.respondent.findFirst({
          where: { projectId: projectIdReal, externalId: identifier, supplierId: null },
          select: { id: true },
        });
        if (existing) {
          respondentId = existing.id;
        } else {
          try {
            const created = await prisma.respondent.create({
              data: { projectId: projectIdReal, externalId: identifier, supplierId: null },
              select: { id: true },
            });
            respondentId = created.id;
          } catch {
            // If creation fails in HTTP mode, still send user to prescreen;
            // the prescreen page will attempt to ensure the row again.
          }
        }
      } else {
        try {
          const r = await prisma.respondent.upsert({
            where: {
              projectId_externalId_supplierId: {
                projectId: projectIdReal,
                externalId: identifier,
                supplierId,
              },
            },
            update: {},
            create: { projectId: projectIdReal, externalId: identifier, supplierId },
            select: { id: true },
          });
          respondentId = r.id;
        } catch {
          // Non-fatal — the prescreen page will handle ensuring the row.
        }
      }

      // How many answers exist for this respondent?
      let answeredCount = 0;
      if (respondentId) {
        answeredCount = await prisma.prescreenAnswer.count({
          where: { respondentId },
        });
      } else {
        // If we couldn't ensure respondent yet, treat as 0 answered to force prescreen.
        answeredCount = 0;
      }

      if (answeredCount < totalQuestions) {
        // There are pending prescreen questions → go to the Prescreen page NOW.
        const prescreenUrl = new URL("/Prescreen", url.origin);
        prescreenUrl.searchParams.set("projectId", projectId);
        if (supplierId) prescreenUrl.searchParams.set("supplierId", supplierId);
        prescreenUrl.searchParams.set("id", identifier);
        return NextResponse.redirect(prescreenUrl.toString(), { status: 302 });
      }
      // else: all prescreen answers present → fall through to client live link
    }
  } catch {
    // If anything goes wrong during the prescreen gate, be defensive and send to Prescreen.
    // This avoids silently skipping prescreen due to a DB error.
    const prescreenUrl = new URL("/Prescreen", url.origin);
    prescreenUrl.searchParams.set("projectId", projectId);
    if (supplierId) prescreenUrl.searchParams.set("supplierId", supplierId);
    prescreenUrl.searchParams.set("id", identifier);
    return NextResponse.redirect(prescreenUrl.toString(), { status: 302 });
  }

  // ---------------- 3) Build the Client URL (pid, rid, token replacements) ----------------
  const pid = id20();
  const replaced = replaceTokens(template, {
    projectId: projectIdReal, // normalized DB id
    supplierId: supplierId ?? "",
    identifier,
    pid,
  });

  // Ensure absolute URL (fallback to SURVEY_PROVIDER_BASE_URL)
  let absolute: URL;
  try {
    absolute = new URL(replaced);
  } catch {
    const base = (process.env.SURVEY_PROVIDER_BASE_URL || "").trim();
    if (!base) {
      return NextResponse.json(
        { error: "SURVEY_PROVIDER_BASE_URL is not set and live URL is relative." },
        { status: 500 }
      );
    }
    absolute = new URL(replaced, base);
  }

  if (!isAllowedScheme(absolute)) {
    return NextResponse.json({ error: "Live URL must use http(s) scheme." }, { status: 400 });
  }

  // Force pid (and rid for providers that echo rid)
  if (!absolute.searchParams.has("pid")) absolute.searchParams.set("pid", pid);
  absolute.searchParams.set("rid", pid);

  // ---------------- 4) Best-effort logging of outbound redirect ----------------
  if (haveRealId) {
    await safeLogRedirect(prisma, {
      id: pid,
      projectId: projectIdReal,
      supplierId,
      externalId: identifier || null,
      destination: absolute.toString(),
    });
  }

  // ---------------- 5) Go to client ----------------
  return NextResponse.redirect(absolute.toString(), { status: 302 });
}