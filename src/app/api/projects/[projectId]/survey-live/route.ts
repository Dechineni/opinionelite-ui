// FILE: src/app/api/projects/[projectId]/survey-live/route.ts
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
  ]) as Promise<{ id: string; surveyLiveUrl: string | null }>;
}

/** Env flag: set REDIRECT_LOG="off" to skip DB log writes */
const LOG_REDIRECT = (process.env.REDIRECT_LOG || "on").toLowerCase() !== "off";
/** Where the prescreen page lives (respect your capital P route) */
const PRESCREEN_PAGE_PATH = process.env.PRESCREEN_PAGE_PATH || "/Prescreen";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierIdRaw = (url.searchParams.get("supplierId") || "").trim();
  const identifier = (url.searchParams.get("id") || "").trim(); // supplier's respondent id
  const supplierId = supplierIdRaw === "" ? null : supplierIdRaw;

  if (!identifier) {
    return NextResponse.json({ error: "Missing id (identifier)" }, { status: 400 });
  }

  // 0) try cache first
  let cached = memGet(`live:${projectId}`);

  // 1) read project (short timeout). If it times out, fall back to cache.
  let projectIdReal = projectId; // normalized to DB id once resolved
  let haveRealId = false;
  let template = cached ?? "";

  if (!cached) {
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
      if (!cached) {
        const msg =
          e?.message === "db-timeout"
            ? "Database timeout while resolving survey link."
            : "Failed to resolve project survey link.";
        return NextResponse.json({ error: msg }, { status: 504 });
      }
      // proceed using cached template (skip DB work below)
    }
  }

  // 2) Prepare the final client URL (we may pass it as `next` if prescreen is pending)
  const pid = id20();
  const replaced = replaceTokens(template, {
    projectId: projectIdReal,
    supplierId: supplierId || "",
    identifier,
    pid,
  });

  let clientUrl: URL;
  try {
    clientUrl = new URL(replaced);
  } catch {
    const base = (process.env.SURVEY_PROVIDER_BASE_URL || "").trim();
    if (!base) {
      return NextResponse.json(
        { error: "SURVEY_PROVIDER_BASE_URL is not set and live URL is relative." },
        { status: 500 }
      );
    }
    clientUrl = new URL(replaced, base);
  }
  if (!isAllowedScheme(clientUrl)) {
    return NextResponse.json({ error: "Live URL must use http(s) scheme." }, { status: 400 });
  }
  // ensure pid and rid for the client provider
  if (!clientUrl.searchParams.has("pid")) clientUrl.searchParams.set("pid", pid);
  clientUrl.searchParams.set("rid", pid);

  // 3) PRESCREEN GATE — only if we have a real project id
  let mustPrescreen = false;
  let respondentId: string | null = null;

  if (haveRealId) {
    // a) are there any prescreen questions for this project?
    const questionCount = await prisma.prescreenQuestion.count({ where: { projectId: projectIdReal } });

    if (questionCount > 0) {
      // b) ensure respondent (NULL cannot be used in composite upsert)
      if (supplierId === null) {
        const existing = await prisma.respondent.findFirst({
          where: { projectId: projectIdReal, externalId: identifier, supplierId: null },
          select: { id: true },
        });
        if (existing) {
          respondentId = existing.id;
        } else {
          const created = await prisma.respondent.create({
            data: { projectId: projectIdReal, externalId: identifier, supplierId: null },
            select: { id: true },
          });
          respondentId = created.id;
        }
      } else {
        const up = await prisma.respondent.upsert({
          where: {
            projectId_externalId_supplierId: {
              projectId: projectIdReal,
              externalId: identifier,
              supplierId: supplierId,
            },
          },
          update: {},
          create: { projectId: projectIdReal, externalId: identifier, supplierId: supplierId },
          select: { id: true },
        });
        respondentId = up.id;
      }

      // c) how many have they already answered?
      const answeredForRespondent = await prisma.prescreenAnswer.count({
        where: { respondentId: respondentId! },
      });

      mustPrescreen = answeredForRespondent < questionCount;
    }
  }

  // 4) Always upsert a SurveyRedirect row for this pid (so /Thanks can resolve later)
  if (LOG_REDIRECT && haveRealId) {
    await prisma.surveyRedirect.upsert({
      where: { id: pid },
      update: { destination: clientUrl.toString() },
      create: {
        id: pid,
        projectId: projectIdReal,
        supplierId: supplierId || null,
        externalId: identifier || null,
        destination: clientUrl.toString(),
      },
    });
  }

  // 5) If prescreen is required, send to /Prescreen with a `next` that points to the clientUrl
  if (mustPrescreen) {
    const prescreen = new URL(PRESCREEN_PAGE_PATH, url.origin);
    prescreen.searchParams.set("projectId", projectIdReal);
    if (supplierId) prescreen.searchParams.set("supplierId", supplierId);
    // new param name is `identifier`; your page also accepts legacy `id`
    prescreen.searchParams.set("identifier", identifier);
    prescreen.searchParams.set("next", clientUrl.toString());
    return NextResponse.redirect(prescreen.toString(), { status: 302 });
  }

  // 6) Otherwise, go straight to client
  return NextResponse.redirect(clientUrl.toString(), { status: 302 });
}