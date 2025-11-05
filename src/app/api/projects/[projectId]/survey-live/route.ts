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

/** Resolve project by id or code with only what we need */
async function loadProjectBasics(prisma: ReturnType<typeof getPrisma>, key: string) {
  return prisma.project.findFirst({
    where: { OR: [{ id: key }, { code: key }] },
    select: { id: true, surveyLiveUrl: true },
  });
}

/** Env flag: set REDIRECT_LOG="off" to skip DB log writes */
const LOG_REDIRECT = (process.env.REDIRECT_LOG || "on").toLowerCase() !== "off";

/** Simple scheme whitelist */
function isAllowedScheme(u: URL) {
  return u.protocol === "http:" || u.protocol === "https:";
}

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
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const template = (project.surveyLiveUrl || "").trim();
  if (!template) {
    return NextResponse.json(
      { error: "Live survey URL is not configured for this project." },
      { status: 400 }
    );
  }

  // 2) Prepare redirect URL
  const pid = id20();
  const replaced = replaceTokens(template, {
    projectId: project.id, // normalize to DB id
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

  // Only allow http/https
  if (!isAllowedScheme(absolute)) {
    return NextResponse.json(
      { error: "Live URL must use http(s) scheme." },
      { status: 400 }
    );
  }

  // 4) Make sure pid is present even if the template missed it
  if (!absolute.searchParams.has("pid")) {
    absolute.searchParams.set("pid", pid);
  }

  // 5) Respond immediately to avoid CPU-time overruns
  const res = NextResponse.redirect(absolute.toString(), { status: 302 });

  // 6) Best-effort minimal logging (single insert, no respondent upserts)
  if (LOG_REDIRECT) {
    prisma.surveyRedirect
      .create({
        data: {
          id: pid,
          projectId: project.id,
          supplierId: supplierId || null,
          externalId: identifier || null,
          destination: absolute.toString(),
        },
      })
      .catch(() => {});
  }

  return res;
}