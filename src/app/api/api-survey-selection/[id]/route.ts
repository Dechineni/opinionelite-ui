// FILE: src/app/api/api-survey-selection/[id]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = getPrisma();
    const { id } = await ctx.params;

    const item = await prisma.apiSurveySelection.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        providerType: true,
        countryCode: true,
        surveyCode: true,
        quotaId: true,
        surveyName: true,
        quota: true,
        loi: true,
        ir: true,
        cpi: true,
        liveUrl: true,
        testUrl: true,
        targetingJson: true,
        rawSurveyJson: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "API survey selection not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to load API survey selection",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = getPrisma();
    const { id } = await ctx.params;
    const b = await req.json();

    const updated = await prisma.apiSurveySelection.update({
      where: { id },
      data: {
        projectId: b.projectId ?? undefined,
      },
      select: {
        id: true,
        projectId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to update API survey selection",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}