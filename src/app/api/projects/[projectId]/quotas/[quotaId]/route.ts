// src/app/api/projects/[projectId]/quotas/[quotaId]/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { recalculateProjectQuotas } from "@/lib/quotas/recalculateProjectQuotas";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
};

async function resolveProjectId(projectIdOrCode: string) {
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
        where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
        select: { id: true },
    });
    return project?.id ?? null;
}

export async function PATCH(
    _req: Request,
    ctx: { params: Promise<{ projectId: string; quotaId: string }> }
) {
    const prisma = getPrisma();

    try {
        const { projectId, quotaId } = await ctx.params;
        const projId = await resolveProjectId(projectId);

        if (!projId) {
            return NextResponse.json({
                error: "Project not found",
            }, { status: 404, headers: NO_STORE_HEADERS });
        }

        const body = await _req.json();

        const targetCompletes = Number(body.targetCompletes);

        if (!Number.isInteger(targetCompletes) || targetCompletes < 0) {
            return NextResponse.json({
                error: "targetCompletes must be a non-negative integer",
            }, { status: 400, headers: NO_STORE_HEADERS });
        }

        const quota = await prisma.projectQuota.findFirst({
            where: {
                id: quotaId,
                projectId: projId,
            },
        });

        if (!quota) {
            return NextResponse.json({
                error: "Quota not found",
            }, { status: 404, headers: NO_STORE_HEADERS });
        }

        const quotaPercent = targetCompletes > 0 ? (quota.quotaCount / targetCompletes) * 100 : 0;

        await prisma.projectQuota.update({
            where: { id: quotaId },
            data: {
                targetCompletes,
                quotaPercent: Number(quotaPercent.toFixed(2)), // Round to 2 decimal places
            }
        });

        await recalculateProjectQuotas(projId);

        const updatedQuota = await prisma.projectQuota.findUnique({
            where: { id: quotaId },
        });

        return NextResponse.json({
            success: true,
            quota: updatedQuota,
        }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
        return NextResponse.json({
            error: "Failed to update target completes",
            details: String(e?.message || e),
        }, { status: 400, headers: NO_STORE_HEADERS });
    }
}