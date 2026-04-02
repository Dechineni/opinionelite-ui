// FILE: src/app/api/api-projects/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type ProjectStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "CLOSED"
  | "INVOICED"
  | "BID";

const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const status = (searchParams.get("status") ?? "").trim() as
      | ProjectStatus
      | "";
    const page = toInt(searchParams.get("page"), 1);
    const pageSize = Math.min(100, toInt(searchParams.get("pageSize"), 10));
    const skip = (page - 1) * pageSize;

    const whereProject: any = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { managerEmail: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const baseWhere = {
      projectId: { not: null },
      project: whereProject,
    } as any;

    const [rows, total, grouped] = await Promise.all([
      prisma.apiSurveySelection.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          surveyCode: true,
          quotaId: true,
          providerType: true,
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              managerEmail: true,
              category: true,
              status: true,
              countryCode: true,
              languageCode: true,
              currency: true,
              loi: true,
              ir: true,
              sampleSize: true,
              projectCpi: true,
              supplierCpi: true,
              startDate: true,
              endDate: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.apiSurveySelection.count({
        where: baseWhere,
      }),
      prisma.project.groupBy({
        by: ["status"],
        where: {
          apiSurveySelection: {
            isNot: null,
          },
        },
        _count: {
          status: true,
        },
      }),
    ]);

    const statusCounts: Record<ProjectStatus, number> = {
      ACTIVE: 0,
      INACTIVE: 0,
      CLOSED: 0,
      INVOICED: 0,
      BID: 0,
    };

    for (const g of grouped) {
      statusCounts[g.status as ProjectStatus] = g._count.status;
    }

    const items = rows
      .filter((r) => r.project)
      .map((r) => ({
        id: r.project!.id,
        code: r.project!.code,
        name: r.project!.name,
        managerEmail: r.project!.managerEmail,
        category: r.project!.category,
        status: r.project!.status,
        countryCode: r.project!.countryCode,
        languageCode: r.project!.languageCode,
        currency: r.project!.currency,
        loi: r.project!.loi,
        ir: r.project!.ir,
        sampleSize: r.project!.sampleSize,
        projectCpi: r.project!.projectCpi,
        supplierCpi: r.project!.supplierCpi,
        startDate: r.project!.startDate,
        endDate: r.project!.endDate,
        clientName: r.project!.client?.name ?? null,
        c: 0,
        t: 0,
        q: 0,
        d: 0,
        surveyCode: r.surveyCode,
        quotaId: r.quotaId,
        providerType: r.providerType,
      }));

    return NextResponse.json({
      items,
      total,
      statusCounts,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to load API projects",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}