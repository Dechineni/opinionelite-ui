// File: src/app/api/projects/[projectId]/quotas/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
};

async function resolveProjectId(projectIdOrCode: string) {
    const prisma = getPrisma();
    const p = await prisma.project.findFirst({
        where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
        select: { id: true },
    });
    return p?.id ?? null;
}

export async function GET(
    _req: Request,
    ctx: { params: Promise<{ projectId: string }> }
) {
    const prisma = getPrisma();

    try {
        const { projectId } = await ctx.params;
        const projId = await resolveProjectId(projectId);

        if (!projId) {
            return NextResponse.json(
                [],
                { headers: NO_STORE_HEADERS }
            );
        }

        const quotas = await prisma.projectQuota.findMany({
            where: { projectId: projId },
            orderBy: { sortOrder: "asc" },
        });

        return NextResponse.json({ items: quotas }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
        return NextResponse.json(
            {
                error: "Failed to load quotas",
                details: String(e?.message || e),
            },
            {
                status: 400,
                headers: NO_STORE_HEADERS,
            }
        );
    }
}

export async function DELETE(
    _req: Request,
    ctx: { params: Promise<{ projectId: string }> }
) {
    const prisma = getPrisma();

    try {
        const { projectId } = await ctx.params;
        const projId = await resolveProjectId(projectId);

        if (!projId) {
            return NextResponse.json(
                {
                    error: "Project not found"
                },
                {
                    status: 404,
                    headers: NO_STORE_HEADERS
                }
            );
        }

        const body = await _req.json();
        const quotaIds = body?.quotaIds;

        if (
            !Array.isArray(quotaIds) ||
            quotaIds.length === 0
        ) {
            return NextResponse.json(
                {
                    error: "quotaIds is required"
                },
                {
                    status: 400,
                    headers: NO_STORE_HEADERS
                }
            );
        }

        const result = await prisma.projectQuota.deleteMany({
            where: {
                projectId: projId,
                id: { in: quotaIds },
            },
        });

        return NextResponse.json(
            {
                success: true,
                deletedCount: result.count,
            },
            {
                headers: NO_STORE_HEADERS
            }
        );
    }
    catch (e: any) {
        return NextResponse.json(
            {
                error: "Failed to delete selected quotas",
                details: String(e?.message || e),
            },
            {
                status: 400,
                headers: NO_STORE_HEADERS,
            }
        );
    }
}
