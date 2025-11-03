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

/**
 * Minimal helper: resolve project by id or code with only what we need.
 */
async function loadProjectBasics(prisma: ReturnType<typeof getPrisma>, projectIdOrCode: string) {
  return prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true, surveyLiveUrl: true },
  });
}

/**
 * Env flags so you can tune behavior without code changes:
 * - REDIRECT_LOG: "on" | "off"  (default "on")
 */
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

  // 1) Read only what we need about the project
  const project = await loadProjectBasics(prisma, projectId);
  if (!project?.surveyLiveUrl) {
    return NextResponse.json(
      { error: "Live survey URL not configured for this project." },
      { status: 400 }
    );
  }

  // 2) Prepare redirect URL
  const pid = id20();
  const replaced = replaceTokens(project.surveyLiveUrl, {
    projectId: project.id,           // normalize to real id
    supplierId,
    identifier,
    pid,
  });

  // 3) Ensure absolute URL (fallback to SURVEY_PROVIDER_BASE_URL)
  let absolute: URL;
  try {
    absolute = new URL(replaced);
  } catch {
    const base = process.env.SURVEY_PROVIDER_BASE_URL;
    if (!base) {
      return NextResponse.json(
        { error: "SURVEY_PROVIDER_BASE_URL is not set." },
        { status: 500 }
      );
    }
    absolute = new URL(replaced, base);
  }

  // 4) Make sure pid is present even if the template missed it
  if (!absolute.searchParams.has("pid")) {
    absolute.searchParams.set("pid", pid);
  }

  // 5) Return the redirect *immediately* to avoid CPU-time overruns
  const res = NextResponse.redirect(absolute.toString(), { status: 302 });

  // 6) Best-effort minimal logging (single insert, no respondent upserts)
  if (LOG_REDIRECT) {
    // Fire and forget — any failure is ignored
    // (Edge keeps executing after we create `res`.)
    prisma.surveyRedirect.create({
      data: {
        id: pid,
        projectId: project.id,
        supplierId: supplierId || null,
        externalId: identifier || null,
        destination: absolute.toString(),
      },
    }).catch(() => {});
  }

  return res;
}