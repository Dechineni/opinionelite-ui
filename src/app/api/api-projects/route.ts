// File: src/app/api/api-projects/route.ts

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

type ProjectLifecycleCounts = {
  entrants: number;
  inProgress: number;
  c: number;
  t: number;
  q: number;
  d: number;
};

const toInt = (value: string | null, defaultValue: number) =>
  value
    ? Math.max(1, parseInt(value, 10) || defaultValue)
    : defaultValue;

const emptyLifecycleCounts = (): ProjectLifecycleCounts => ({
  entrants: 0,
  inProgress: 0,
  c: 0,
  t: 0,
  q: 0,
  d: 0,
});

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();

    const status = (searchParams.get("status") ?? "").trim() as
      | ProjectStatus
      | "";

    const page = toInt(searchParams.get("page"), 1);

    const pageSize = Math.min(
      100,
      toInt(searchParams.get("pageSize"), 10)
    );

    const skip = (page - 1) * pageSize;

    const whereProject: any = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              {
                code: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                managerEmail: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                client: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };

    const baseWhere = {
      projectId: {
        not: null,
      },
      project: whereProject,
    } as any;

    const [rows, total, grouped] = await Promise.all([
      prisma.apiSurveySelection.findMany({
        where: baseWhere,
        orderBy: {
          updatedAt: "desc",
        },
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

    for (const group of grouped) {
      statusCounts[group.status as ProjectStatus] =
        group._count.status;
    }

    const projectIds = Array.from(
      new Set(
        rows
          .map((row) => row.project?.id)
          .filter(
            (projectId): projectId is string =>
              Boolean(projectId)
          )
      )
    );

    const byProject: Record<
      string,
      ProjectLifecycleCounts
    > = {};

    /*
     * SupplierEntry is the lifecycle source for:
     *
     * - Entrants
     * - In Progress
     * - Complete
     * - Terminate
     * - OverQuota
     * - Drop Out
     *
     * One grouped query is used for all projects on the
     * current page to avoid separate queries per project.
     */
    if (projectIds.length > 0) {
      const entryGroups =
        await prisma.supplierEntry.groupBy({
          by: ["projectId", "finalOutcome"],
          where: {
            projectId: {
              in: projectIds,
            },
          },
          _count: {
            _all: true,
          },
        });

      for (const group of entryGroups) {
        const lifecycle =
          (byProject[group.projectId] ??=
            emptyLifecycleCounts());

        const count = group._count._all;

        /*
         * Every SupplierEntry row represents one unique
         * tracked project/supplier/respondent entrant.
         */
        lifecycle.entrants += count;

        if (group.finalOutcome === null) {
          lifecycle.inProgress += count;
          continue;
        }

        const finalOutcome = String(
          group.finalOutcome
        ).toUpperCase();

        switch (finalOutcome) {
          case "COMPLETE":
            lifecycle.c += count;
            break;

          case "TERMINATE":
            lifecycle.t += count;
            break;

          case "OVER_QUOTA":
          case "OVERQUOTA":
            lifecycle.q += count;
            break;

          /*
           * Survey Close is displayed operationally
           * under the Drop Out column.
           */
          case "DROP_OUT":
          case "SURVEY_CLOSE":
            lifecycle.d += count;
            break;

          /*
           * The API Project List currently has no
           * separate Quality Term column.
           */
          case "QUALITY_TERM":
            break;

          default:
            console.warn(
              "Unknown SupplierEntry final outcome in API project list:",
              {
                projectId: group.projectId,
                finalOutcome,
              }
            );
            break;
        }
      }
    }

    const items = rows
      .filter((row) => row.project)
      .map((row) => {
        const project = row.project!;

        const lifecycle =
          byProject[project.id] ??
          emptyLifecycleCounts();

        return {
          id: project.id,
          code: project.code,
          name: project.name,
          managerEmail: project.managerEmail,
          category: project.category,
          status: project.status,
          countryCode: project.countryCode,
          languageCode: project.languageCode,
          currency: project.currency,
          loi: project.loi,
          ir: project.ir,
          sampleSize: project.sampleSize,
          projectCpi: project.projectCpi,
          supplierCpi: project.supplierCpi,
          startDate: project.startDate,
          endDate: project.endDate,
          clientName: project.client?.name ?? null,

          entrants: lifecycle.entrants,
          inProgress: lifecycle.inProgress,

          c: lifecycle.c,
          t: lifecycle.t,
          q: lifecycle.q,
          d: lifecycle.d,

          surveyCode: row.surveyCode,
          quotaId: row.quotaId,
          providerType: row.providerType,
        };
      });

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
      {
        status: 500,
      }
    );
  }
}