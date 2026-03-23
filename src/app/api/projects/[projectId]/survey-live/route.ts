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

  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    typeof (globalThis as any).crypto.getRandomValues === "function"
  ) {
    (globalThis as any).crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return s;
}

/** Replace tokens like [identifier], {identifier}, [projectId], [supplierId], [externalId] */
function replaceTokens(template: string, map: Record<string, string>) {
  // Support both [token] and {token}
  return template
    .replace(/\[([^\]]+)\]/g, (_, k) => map[k] ?? "")
    .replace(/\{([^}]+)\}/g, (_, k) => map[k] ?? "");
}

/** Simple scheme whitelist */
function isAllowedScheme(u: URL) {
  return u.protocol === "http:" || u.protocol === "https:";
}

/* ----------------------- ultra-light memory cache ----------------------- */
type CacheEntry = { v: { id: string; template: string }; exp: number };
type MemCache = Map<string, CacheEntry>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = globalThis as any;
const MEM_TTL_MS = 5 * 60 * 1000; // 5 min
const mem: MemCache = (G.__surveyLiveCache ??= new Map<string, CacheEntry>());
function memGet(k: string): { id: string; template: string } | null {
  const e = mem.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) {
    mem.delete(k);
    return null;
  }
  return e.v;
}
function memPut(k: string, v: { id: string; template: string }) {
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
      select: { id: true, code: true, surveyLiveUrl: true },
    }),
    new Promise<null>((_, rej) =>
      setTimeout(() => rej(new Error("db-timeout")), ms)
    ),
  ]) as Promise<{ id: string; code: string; surveyLiveUrl: string | null }>;
}

/** Env flag: set REDIRECT_LOG="off" to skip DB log writes */
const LOG_REDIRECT =
  (process.env.REDIRECT_LOG || "on").toLowerCase() !== "off";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const externalId = (url.searchParams.get("id") || "").trim(); // OP Panel user id (e.g. 102)

  // 0) cache
  const cached = memGet(`live:${projectId}`);

  // 1) read project
  let projectIdReal = projectId;
  let haveRealId = false;
  let projectCodeReal = projectId;
  let template = cached?.template ?? "";

  if (cached) {
    projectIdReal = cached.id;
    haveRealId = true;
  } else {
    try {
      const project = await loadProjectBasicsWithTimeout(prisma, projectId);
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      projectIdReal = project.id;
      projectCodeReal = project.code;
      haveRealId = true;
      template = (project.surveyLiveUrl || "").trim();
      if (!template) {
        return NextResponse.json(
          { error: "Live survey URL is not configured for this project." },
          { status: 400 }
        );
      }
      memPut(`live:${projectId}`, { id: project.id, template });
      memPut(`live:${project.id}`, { id: project.id, template });
      memPut(`live:${project.code}`, { id: project.id, template });
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

  if (haveRealId && externalId && supplierId) {
    const priorAttempt = await prisma.surveyRedirect.findFirst({
      where: {
        projectId: projectIdReal,
        supplierId,
        externalId,
      },
      select: { id: true, result: true },
    });

    if (priorAttempt) {
      return NextResponse.json(
        {
          error: "Survey already attempted.",
          projectId: projectCodeReal || projectIdReal,
          supplierId,
          priorPid: priorAttempt.id,
          priorResult: priorAttempt.result ?? null,
        },
        { status: 409 }
      );
    }
  }

  // 1.5) best-effort respondent ensure (uses externalId)
  if (haveRealId && externalId) {
    try {
      if (supplierId) {
        const found = await prisma.respondent.findUnique({
          where: {
            projectId_externalId_supplierId: {
              projectId: projectIdReal,
              externalId,
              supplierId,
            },
          },
          select: { id: true },
        });
        if (!found) {
          try {
            await prisma.respondent.create({
              data: { projectId: projectIdReal, externalId, supplierId },
            });
          } catch (e) {
            if (!isUniqueViolation(e)) throw e;
          }
        }
      } else {
        const found = await prisma.respondent.findFirst({
          where: { projectId: projectIdReal, externalId, supplierId: null },
          select: { id: true },
        });
        if (!found) {
          try {
            await prisma.respondent.create({
              data: { projectId: projectIdReal, externalId, supplierId: null },
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
  const pid = id20(); // ✅ our unique id for this redirect (the [identifier] value)

  // Detect whether template actually uses identifier placeholder
  const hasIdentifierToken =
    /\[identifier\]/i.test(template) || /\{identifier\}/i.test(template);

  // ✅ Replace [identifier] (or {identifier}) with pid.
  // Keep external id separately available as [externalId] if needed.
  const replaced = replaceTokens(template, {
    projectId: projectIdReal,
    supplierId,
    identifier: pid,        // ✅ THIS is the key fix
    externalId: externalId, // optional token if you ever need it
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
    return NextResponse.json(
      { error: "Live URL must use http(s) scheme." },
      { status: 400 }
    );
  }

  // 4) Fallback behavior:
  // - If template had [identifier]/{identifier}, we already injected pid where needed.
  // - If template did NOT have placeholder, add rid=pid ONLY if rid is missing.
  if (!hasIdentifierToken) {
    if (!absolute.searchParams.has("rid")) {
      absolute.searchParams.set("rid", pid);
    }
  }

  // 5) Log redirect (idempotent by primary key id=pid)
  if (LOG_REDIRECT && haveRealId) {
    await prisma.surveyRedirect.upsert({
      where: { id: pid },
      update: { destination: absolute.toString() },
      create: {
        id: pid,
        projectId: projectIdReal,
        supplierId: supplierId || null,  // may be Supplier.code like S1007
        externalId: externalId || null,  // OP Panel user id (e.g. 102)
        destination: absolute.toString(),
      },
    });
  }

  // 6) Redirect
  return NextResponse.redirect(absolute.toString(), { status: 302 });
}