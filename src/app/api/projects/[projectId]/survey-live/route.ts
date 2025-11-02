// FILE: src/app/api/projects/[projectId]/survey-live/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// Generate a 20-char id with a URL-safe alphabet (no deps)

function id20() {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// Replace tokens like [identifier], [projectId], [supplierId], [pid]
function replaceTokens(template: string, map: Record<string, string>) {
  return template.replace(/\[([^\]]+)\]/g, (_, k) => map[k] ?? "");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = url.searchParams.get("supplierId") ?? "";
  const identifier = url.searchParams.get("id") ?? "";

  // 1) Resolve project by id or code
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: { id: true, surveyLiveUrl: true },
  });

  if (!project?.surveyLiveUrl) {
    return NextResponse.json(
      { error: "Live survey URL not configured for this project." },
      { status: 400 }
    );
  }

  // 2) Generate the 20-char pid
  const pid = id20();

  // 3) Token replacement
  const replaced = replaceTokens(project.surveyLiveUrl, {
    projectId,
    supplierId,
    identifier,
    pid, // new token
  });

  // 4) Ensure absolute URL
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

  // 5) Safety net: if template didn’t include [pid], append it
  if (!absolute.searchParams.has("pid")) {
    absolute.searchParams.set("pid", pid);
  }

  // 6) Best-effort: ensure/find respondent so we can link the log (Option A)
  let respondentId: string | undefined = undefined;
  try {
    const existing = await prisma.respondent.findFirst({
      where: {
        projectId: project.id,
        externalId: identifier || "",
        supplierId: supplierId || null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.respondent.update({
        where: { id: existing.id },
        data: { supplierId: supplierId || null },
      });
      respondentId = existing.id;
    } else {
      const created = await prisma.respondent.create({
        data: {
          projectId: project.id,
          externalId: identifier || "",
          supplierId: supplierId || null,
        },
        select: { id: true },
      });
      respondentId = created.id;
    }
  } catch {
    // ignore; we'll log redirect even without respondent linkage
  }

  // 7) Log the redirect
  try {
    await prisma.surveyRedirect.create({
      data: {
        id: pid,
        projectId: project.id,
        respondentId: respondentId,
        supplierId: supplierId || null,
        externalId: identifier || null,
        destination: absolute.toString(),
      },
    });
  } catch {
    // ignore logging failures
  }

  // 8) Redirect to the provider
  return NextResponse.redirect(absolute.toString(), { status: 302 });
}