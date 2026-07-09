export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { projectId } = await ctx.params;

    const body = await req.json().catch(() => ({}));

    const supplierCode = String(body?.supplierId || "").trim();
    const externalId = String(body?.externalId || body?.id || "").trim();
    const recid = String(body?.recid || "").trim();

    if (!projectId || !supplierCode || !externalId) {
      return NextResponse.json(
        {
          error: "Missing projectId, supplierId, or externalId",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [{ id: projectId }, { code: projectId }],
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const entry = await prisma.supplierEntry.upsert({
      where: {
        projectId_supplierCode_externalId: {
          projectId: project.id,
          supplierCode,
          externalId,
        },
      },

      create: {
        projectId: project.id,
        projectCode: project.code,
        supplierCode,
        externalId,
        currentStage: "ENTERED",
        entryCount: 1,
        recid
      },

      update: {
        projectCode: project.code,
        lastEnteredAt: new Date(),
        entryCount: {
          increment: 1,
        },
        recid
      },

      select: {
        id: true,
        projectCode: true,
        supplierCode: true,
        externalId: true,
        firstEnteredAt: true,
        lastEnteredAt: true,
        entryCount: true,
        currentStage: true,
      },
    });

    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (error) {
    console.error("Failed to track supplier entry:", error);

    return NextResponse.json(
      {
        error: "Failed to track supplier entry",
      },
      { status: 500 }
    );
  }
}