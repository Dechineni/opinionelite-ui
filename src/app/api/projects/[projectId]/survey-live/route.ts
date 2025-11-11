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
  ]) as Promise<{ id: string; surveyLiveUrl: string | null }>;
}

/** Env flag: set REDIRECT_LOG="off" to skip DB log writes */
const LOG_REDIRECT = (process.env.REDIRECT_LOG || "on").toLowerCase() !== "off";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const identifier = (url.searchParams.get("id") || "").trim();

  // 0) try cache first
  // We key by the raw path param so SR0001 and its DB id can both cache.
  const cached = memGet(`live:${projectId}`);

  // 1) read project (short timeout). If it times out, fall back to cache.
  let projectIdReal = projectId; // will be normalized to DB id when we resolve it
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
      // warm cache for both keys (code/id)
      memPut(`live:${projectId}`, template);
      memPut(`live:${project.id}`, template);
    } catch (e: any) {
      if (!cached) {
        // first load, nothing cached → return fast instead of hanging
        const msg =
          e?.message === "db-timeout"
            ? "Database timeout while resolving survey link."
            : "Failed to resolve project survey link.";
        return NextResponse.json({ error: msg }, { status: 504 });
      }
      // we have a cached template; proceed using it (but skip DB logging below)
    }
  }

  // 2) Prepare redirect URL
  const pid = id20();
  const replaced = replaceTokens(template, {
    projectId: projectIdReal, // normalize to DB id when we had it
    supplierId,
    identifier,
    pid,
  });

  // 3) Ensure absolute URL (fallback to SURVEY_PROVIDER_BASE_URL)
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

  // 4) ensure pid
  if (!absolute.searchParams.has("pid")) {
    absolute.searchParams.set("pid", pid);
  }

  // keep rid aligned to pid so /Thanks gets the correct id
  absolute.searchParams.set("rid", pid);

  // 5) Persist redirect BEFORE responding (idempotent). Only when we have the real DB id.
  if (LOG_REDIRECT && haveRealId) {
    await prisma.surveyRedirect.upsert({
      where: { id: pid },
      update: { destination: absolute.toString() },
      create: {
        id: pid,
        projectId: projectIdReal,            // required FK → real DB id
        supplierId: supplierId || null,
        externalId: identifier || null,
        destination: absolute.toString(),
      },
    });
  }

  // 6) Now return the redirect
  return NextResponse.redirect(absolute.toString(), { status: 302 });
}