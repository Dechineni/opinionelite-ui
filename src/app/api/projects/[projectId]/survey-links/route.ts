// FILE: src/app/api/projects/[projectId]/survey-links/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/* ------------------------------ GET ------------------------------ */
const prisma = getPrisma();

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;     // ← await it
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      surveyLinkType: true,
      surveyLiveUrl: true,
      surveyTestUrl: true,
    },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    type: (p.surveyLinkType || "SINGLE").toLowerCase(),
    liveUrl: p.surveyLiveUrl || "",
    testUrl: p.surveyTestUrl || "",
  });
}

/* ------------------------------ PUT ------------------------------ */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;     // ← await it
  const { type, liveUrl, testUrl } = await req.json();

  if (!liveUrl || typeof liveUrl !== "string") {
    return NextResponse.json({ error: "Live URL required" }, { status: 400 });
  }
  if (testUrl !== undefined && typeof testUrl !== "string") {
    return NextResponse.json({ error: "Invalid Test URL" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      surveyLinkType: String(type || "single").toUpperCase() as any, // "SINGLE" | "MULTI"
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
}