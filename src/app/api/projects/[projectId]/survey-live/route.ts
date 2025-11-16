export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const isUniqueViolation = (e: any) => {
  const msg = String(e?.message || "");
  return (
    (e && e.code === "P2002") ||
    /Unique constraint failed/i.test(msg) ||
    /duplicate key value violates unique constraint/i.test(msg)
  );
};

/** 20-char URL-safe id, Edge-safe (no Node imports). */
function id20(): string {
  const abc =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);

  // Use Web Crypto if available (Edge/Workers/Browser)
  if (typeof globalThis !== "undefined" &&
      (globalThis as any).crypto &&
      typeof (globalThis as any).crypto.getRandomValues === "function") {
    (globalThis as any).crypto.getRandomValues(bytes);
  } else {
    // Build-time / non-web fallback — not cryptographically strong,
    // but sufficient for a unique redirect id during local builds.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return s;
}

/** Replace tokens like [identifier], [projectId], [supplierId] */
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const identifier = (url.searchParams.get("id") || "").trim();

  // 0) cache
  const cached = memGet(`live:${projectId}`);

  // 1) read project
  let projectIdReal = projectId;
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
      // fall back to cached template
    }
  }

  // 1.5) best-effort respondent ensure
  if (haveRealId && identifier) {
    try {
      if (supplierId) {
        const found = await prisma.respondent.findUnique({
          where: {
            projectId_externalId_supplierId: {
              projectId: projectIdReal,
              externalId: identifier,
              supplierId,
            },
          },
          select: { id: true },
        });
        if (!found) {
          try {
            await prisma.respondent.create({
              data: { projectId: projectIdReal, externalId: identifier, supplierId },
            });
          } catch (e) {
            if (!isUniqueViolation(e)) throw e;
          }
        }
      } else {
        const found = await prisma.respondent.findFirst({
          where: { projectId: projectIdReal, externalId: identifier, supplierId: null },
          select: { id: true },
        });
        if (!found) {
          try {
            await prisma.respondent.create({
              data: { projectId: projectIdReal, externalId: identifier, supplierId: null },
            });
          } catch (e) {
            if (!isUniqueViolation(e)) throw e;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2) Prepare redirect URL
  const pid = id20(); // our unique id for this redirect
  const replaced = replaceTokens(template, {
    projectId: projectIdReal,
    supplierId,
    identifier, // only used if template contains [identifier]
  });

  // 3) Absolute URL
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

  // 4) only set "rid" to pid; do NOT add "pid" anymore
  absolute.searchParams.set("rid", pid);

  // 5) Log redirect (idempotent by primary key id=pid)
  if (LOG_REDIRECT && haveRealId) {
    await prisma.surveyRedirect.upsert({
      where: { id: pid },
      update: { destination: absolute.toString() },
      create: {
        id: pid,
        projectId: projectIdReal,
        supplierId: supplierId || null,
        externalId: identifier || null, // original supplier id (e.g., 387/388)
        destination: absolute.toString(),
      },
    });
  }

  // 6) Redirect
  return NextResponse.redirect(absolute.toString(), { status: 302 });
}