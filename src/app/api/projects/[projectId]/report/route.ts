export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";;

export async function generateProjectReport(
  projectId: string
) {

    // PRISMA DATABASE
    const prisma = getPrisma();

    // QUERY TO GET ALL PROJECT SUMMARY REPORT DATA
    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
        },
        select: {
            name: true,
            code: true,
            projectCpi: true,
            managerEmail: true,

            supplierEntries: {
            select: {
                supplierCode: true,
                externalId: true,
                firstEnteredAt: true,
                finalOutcomeAt: true,
                finalOutcome: true,
                finalSource: true,
            },
            },

            supplierMappings: {
            select: {
                cpi: true,
                supplier: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
                },
            },
            },
        },
    });

    // CHECK PROJECT IS FOUND OR NOT
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
          data: null,
        },
        { status: 404 }
      );
    }

    // CALCULATE ENTRANTS
    const entrants = project.supplierEntries.length;

    let inProgress = 0;
    let complete = 0;
    let terminate = 0;
    let prescreenTerminate = 0;
    let overQuota = 0;
    let qualityTerminate = 0;
    let dropOut = 0;

    // LOOPING ALL SUPPLIERENTRIES AND CALCULATE ALL THINGS LIKE INPROGRESS, COMPLETE, TERMINATE, PRESCREEN TERMINATE, OVERQUOTA, QUANLITY TERMINATE, DROPOUT
    for (const entry of project.supplierEntries) {
      const { finalOutcome, finalSource } = entry;

      if (finalOutcome === null) {
        inProgress++;
        continue;
      }

      if (finalOutcome === "COMPLETE") {
        complete++;
        continue;
      }

      if (finalOutcome === "TERMINATE" && finalSource === "PRESCREEN_FAIL") {
        prescreenTerminate++;
        continue;
      }

      if (finalOutcome === "TERMINATE" && finalSource !== "PRESCREEN_FAIL") {
        terminate++;
        continue;
      }

      if (finalOutcome === "OVER_QUOTA") {
        overQuota++;
        continue;
      }

      if (finalOutcome === "QUALITY_TERM") {
        qualityTerminate++;
        continue;
      }

      if (finalOutcome === "SURVEY_CLOSE" || finalOutcome === "DROP_OUT") {
        dropOut++;
      }

    }

    // CALCULATE TOTAL Complete + Terminate + Prescreener Terminate + Over Quota + Quality Terminate + Drop Out
    const total = complete + terminate + prescreenTerminate + overQuota + qualityTerminate + dropOut;

    const reconciliationPassed = entrants === inProgress + total;

    // PREPARE PROJECT SUMMARY DATA 
    const projectSummaryData = {
      projectName: project.name,
      surveyCode: project.code,
      projectManager: project.managerEmail,
      entrants,
      inProgress,
      complete,
      terminate,
      prescreenTerminate,
      overQuota,
      qualityTerminate,
      dropOut,
      total,
      reconciliationPassed,
    };

    // SUPPLIER LOOKUP
    const supplierLookup = new Map(
    project.supplierMappings.map((mapping) => [
        mapping.supplier.code,
        {
        supplierName: mapping.supplier.name,
        supplierCpi: Number(mapping.cpi),
        },
    ])
    );

    // STATUS DESCRIPTION HELPER
    const getStatusDescription = (
    finalOutcome: string | null,
    finalSource: string | null
    ) => {
    if (finalOutcome === null) {
        return "In Progress";
    }

    if (finalOutcome === "COMPLETE") {
        return "Complete";
    }

    if (
        finalOutcome === "TERMINATE" &&
        finalSource === "PRESCREEN_FAIL"
    ) {
        return "Prescreener Terminate";
    }

    if (finalOutcome === "TERMINATE") {
        return "Terminate";
    }

    if (finalOutcome === "OVER_QUOTA") {
        return "Over Quota";
    }

    if (finalOutcome === "QUALITY_TERM") {
        return "Quality Terminate";
    }

    if (
        finalOutcome === "SURVEY_CLOSE" ||
        finalOutcome === "DROP_OUT"
    ) {
        return "Drop Out";
    }

    return "";
    };

    // RESPONDENT DETAILS REPORT
    const respondentDetailsData =
    project.supplierEntries.map(
        (entry, index) => {
        const supplierInfo =
            supplierLookup.get(entry.supplierCode);

        const loi =
            entry.firstEnteredAt &&
            entry.finalOutcomeAt
            ? Math.round(
                (
                    entry.finalOutcomeAt.getTime() -
                    entry.firstEnteredAt.getTime()
                ) / 60000
                ).toFixed(2)
            : "";

        return {
            serialNo: index + 1,

            supplierId:
            entry.supplierCode,

            supplierName:
            supplierInfo?.supplierName ?? "",

            supplierIdentifier:
            entry.externalId,

            projectCpi:
            Number(project.projectCpi),

            supplierCpi:
            supplierInfo?.supplierCpi ?? null,

            statusDescription:
            getStatusDescription(
                entry.finalOutcome,
                entry.finalSource
            ),

            startDateTime:
            entry.firstEnteredAt,

            endDateTime:
            entry.finalOutcomeAt,

            loi,
        };
        }
    );

    return {
        projectSummaryData,
        respondentDetailsData
    }
}

export async function generatePrescreenReport(
  projectId: string
) {
  return {
    reportType: "prescreen",
    message: "Prescreen report is not implemented yet.",
    data: [],
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await ctx.params;

    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").trim();

    const supportedTypes = new Set([
      "project",
      "prescreen",
    ]);

    if (!type || !supportedTypes.has(type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported report type.",
          data: null,
        },
        {
          status: 400,
        }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "Project ID is required.",
          data: null,
        },
        {
          status: 400,
        }
      );
    }

    let reportData;

    if (type === "project") {
      reportData = await generateProjectReport(
        projectId
      );

      return NextResponse.json(
        {
          success: true,
          message: "Project report generated successfully.",
          data: reportData,
        },
        {
          status: 200,
        }
      );
    }

    if (type === "prescreen") {
      reportData =
        await generatePrescreenReport(
          projectId
        );

      return NextResponse.json(
        {
          success: true,
          message: "Prescreen report generated successfully.",
          data: reportData,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unsupported report type.",
        data: null,
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error("Report Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
        data: null,
      },
      {
        status: 500,
      }
    );
  }
}
