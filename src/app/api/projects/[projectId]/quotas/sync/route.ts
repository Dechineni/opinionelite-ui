// File: src/app/api/projects/[projectId]/quotas/sync/route.ts

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

export async function POST(
    req: Request,
    ctx: {
        params: Promise<{ projectId: string }>;
    }
) {
    const prisma = getPrisma();

    try {
        const { projectId } = await ctx.params;

        const projId = await resolveProjectId(projectId);

        if (!projId) {
            return NextResponse.json(
                { error: "Project not found" },
                {
                    status: 404,
                    headers: NO_STORE_HEADERS,
                }
            );
        }

        const body = await req.json();

        const prescreenQuestionId =
            body?.prescreenQuestionId;

        if (!prescreenQuestionId) {
            return NextResponse.json(
                {
                    error: "prescreenQuestionId is required",
                },
                {
                    status: 400,
                    headers: NO_STORE_HEADERS,
                }
            );
        }

        const question =
            await prisma.prescreenQuestion.findFirst({
                where: {
                    id: prescreenQuestionId,
                    projectId: projId,
                },
                include: {
                    options: {
                        orderBy: {
                            sortOrder: "asc",
                        },
                    },
                },
            });

        if (!question) {
            return NextResponse.json(
                {
                    error: "Question not found for this project",
                },
                {
                    status: 404,
                    headers: NO_STORE_HEADERS,
                }
            );
        }

        // Sync quotas based on the question and its options
        const mappedOptions =
            question.options.filter(
                (option) => option.enabled && option.label?.trim()
            );

        if (mappedOptions.length === 0) {
            return NextResponse.json(
                {
                    message:
                        "No mapped options available to sync.",
                },
                {
                    status: 400,
                    headers: NO_STORE_HEADERS,
                }
            );
        }

        const agg =
            await prisma.projectQuota.aggregate({
                where: {
                    projectId: projId,
                },
                _max: {
                    sortOrder: true,
                },
            });

        let nextSortOrder =
            (agg._max.sortOrder ?? 0) + 1;

        for (const option of mappedOptions) {
            const existing =
                await prisma.projectQuota.findFirst({
                    where: {
                        projectId: projId,
                        prescreenQuestionId:
                            question.id,
                        quotaName: option.label,
                    },
                });

            if (existing) {
                continue;
            }

            await prisma.projectQuota.create({
                data: {
                    projectId: projId,

                    prescreenQuestionId:
                        question.id,

                    prescreenQuestionTitle:
                        question.title,

                    quotaName: option.label.trim(),

                    status: "Open",

                    targetCompletes: 0,
                    quotaCount: 0,
                    quotaPercent: 0,

                    totalAccesses: 0,
                    prescreenClicks: 0,
                    completes: 0,
                    terminates: 0,
                    overQuotas: 0,

                    sortOrder:
                        nextSortOrder++,
                },
            });
        }

        const quotas =
            await prisma.projectQuota.findMany({
                where: {
                    projectId: projId,
                },
                orderBy: {
                    sortOrder: "asc",
                },
            });

        return NextResponse.json(
            quotas,
            {
                headers: NO_STORE_HEADERS,
            }
        );
    } catch (e: any) {
        return NextResponse.json(
            {
                error:
                    "Failed to sync mapped options",
                detail: String(
                    e?.message || e
                ),
            },
            {
                status: 400,
                headers: NO_STORE_HEADERS,
            }
        );
    }
}
