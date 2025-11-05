// FILE: src/app/api/projects/[projectId]/survey-links/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/* ------------------------- small helpers ------------------------- */
function normType(v: unknown): "SINGLE" | "MULTI" {
  const s = String(v ?? "single").trim().toUpperCase();
  return s === "MULTI" ? "MULTI" : "SINGLE";
}

async function resolveProjectId(projectKey: string) {
  const prisma = getPrisma();
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectKey }, { code: projectKey }] },
    select: { id: true },
  });
  return p?.id ?? null;
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

/* ------------------------------ GET ------------------------------ */
// GET /api/projects/:projectIdOrCode/survey-links
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return bad("Not found", 404);

  const p = await prisma.project.findUnique({
    where: { id: projId },
    select: {
      surveyLinkType: true,
      surveyLiveUrl: true,
      surveyTestUrl: true,
    },
  });

  // If somehow missing, treat as 404
  if (!p) return bad("Not found", 404);

  return NextResponse.json({
    type: (p.surveyLinkType || "SINGLE").toLowerCase(),
    liveUrl: p.surveyLiveUrl || "",
    testUrl: p.surveyTestUrl || "",
  });
}

/* ------------------------------ PUT ------------------------------ */
// PUT /api/projects/:projectIdOrCode/survey-links
// Body: { type?: "single" | "multi", liveUrl: string, testUrl?: string }
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId: projectKey } = await ctx.params;

  const projId = await resolveProjectId(projectKey);
  if (!projId) return bad("Not found", 404);

  const body = await req.json();
  const type = normType(body?.type);
  const liveUrl = typeof body?.liveUrl === "string" ? body.liveUrl.trim() : "";
  const testUrl =
    body?.testUrl === undefined
      ? undefined
      : typeof body.testUrl === "string"
      ? body.testUrl.trim()
      : null;

  if (!liveUrl) return bad("Live URL required", 400);
  if (testUrl !== undefined && testUrl !== null && typeof testUrl !== "string") {
    return bad("Invalid Test URL", 400);
  }

  try {
    const updated = await prisma.project.update({
      where: { id: projId },
      data: {
        surveyLinkType: type, // "SINGLE" | "MULTI"
        surveyLiveUrl: liveUrl,
        surveyTestUrl: testUrl ?? "",
      },
      select: {
        surveyLinkType: true,
        surveyLiveUrl: true,
        surveyTestUrl: true,
      },
    });

    return NextResponse.json({
      type: (updated.surveyLinkType || "SINGLE").toLowerCase(),
      liveUrl: updated.surveyLiveUrl || "",
      testUrl: updated.surveyTestUrl || "",
    });
  } catch (e: any) {
    // Handle missing row or other prisma errors gracefully
    if (e?.code === "P2025") return bad("Not found", 404);
    return bad("Update failed", 400);
  }
}