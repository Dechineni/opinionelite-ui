import { getPrisma } from "@/lib/prisma";

// CREATE STATUS CONSTANTS
const STATUS = {
  COMPLETE: "COMPLETE",
  TERMINATE: "TERMINATE",
  OVER_QUOTA: "OVER_QUOTA",
  QUALITY_TERM: "QUALITY_TERM",
  DROP_OUT: "DROP_OUT",
  SURVEY_CLOSE: "SURVEY_CLOSE",
} as const;

// CREATE SOURCE CONSTANTS
const SOURCE = {
  PRESCREEN_FAIL: "PRESCREEN_FAIL",
} as const;

// FUNCTION TO GENERATE PROJECT SUMMARY REPORT AND RESPONDENT DETAILS
export async function generateProjectReport(
  projectId: string
) {

  // INITIALIZE PRISMA CLIENT
  const prisma = getPrisma();

  // GET PROJECT DATA AND RELATED REPORT DETAILS
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
          isBackfilled: true
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

  // CHECK PROJECT IS EXISTS
  if (!project) {
    throw new Error("Project not found");
  }

  // GET TOTAL NUMBER OF ENTRANTS
  const entrants = project.supplierEntries.length;

  // CREATE METRICS
  const metrics = {
    inProgress: 0,
    complete: 0,
    terminate: 0,
    prescreenTerminate: 0,
    overQuota: 0,
    qualityTerminate: 0,
    dropOut: 0,
  };

  // CALCULATE RESPONDENT COUNTS
  for (const entry of project.supplierEntries) {
    const { finalOutcome, finalSource } = entry;

    // Respondent has not completed the survey flow
    if (finalOutcome === null) {
      metrics.inProgress++;
      continue;
    }

    // Successfully completed survey
    if (finalOutcome === STATUS.COMPLETE) {
      metrics.complete++;
      continue;
    }

    // Failed during prescreener
    if (
      finalOutcome === STATUS.TERMINATE &&
      finalSource === SOURCE.PRESCREEN_FAIL
    ) {
      metrics.prescreenTerminate++;
      continue;
    }

    // Terminated for reasons other than prescreener failure
    if (
      finalOutcome === STATUS.TERMINATE &&
      finalSource !== SOURCE.PRESCREEN_FAIL
    ) {
      metrics.terminate++;
      continue;
    }

    // Respondent reached quota limit
    if (finalOutcome === STATUS.OVER_QUOTA) {
      metrics.overQuota++;
      continue;
    }

    // Respondent failed quality checks
    if (finalOutcome === STATUS.QUALITY_TERM) {
      metrics.qualityTerminate++;
      continue;
    }

    // Respondent dropped before completion
    if (
      finalOutcome === STATUS.SURVEY_CLOSE ||
      finalOutcome === STATUS.DROP_OUT
    ) {
      metrics.dropOut++;
      continue;
    }
  }

  // CALCULATE TOTAL COMPLATED RECORDS
  const total = metrics.complete + metrics.terminate + metrics.prescreenTerminate + metrics.overQuota + metrics.qualityTerminate + metrics.dropOut;

  // VERIFY COUNTS ARE MATCHING
  const reconciliationPassed = entrants === metrics.inProgress + total;

  // PREPARE PROJECT SUMMARY DATA 
  const projectSummaryData = {
    projectName: project.name,
    surveyCode: project.code,
    projectManager: project.managerEmail,
    entrants,
    inProgress: metrics.inProgress,
    complete: metrics.complete,
    terminate: metrics.terminate,
    prescreenTerminate: metrics.prescreenTerminate,
    overQuota: metrics.overQuota,
    qualityTerminate: metrics.qualityTerminate,
    dropOut: metrics.dropOut,
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

    if (finalOutcome === STATUS.COMPLETE) {
      return "Complete";
    }

    if (
      finalOutcome === STATUS.TERMINATE &&
      finalSource === SOURCE.PRESCREEN_FAIL
    ) {
      return "Prescreener Terminate";
    }

    if (finalOutcome === STATUS.TERMINATE) {
      return "Terminate";
    }

    if (finalOutcome === STATUS.OVER_QUOTA) {
      return "Over Quota";
    }

    if (finalOutcome === STATUS.QUALITY_TERM
    ) {
      return "Quality Terminate";
    }

    if (
      finalOutcome === STATUS.SURVEY_CLOSE ||
      finalOutcome === STATUS.DROP_OUT
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

       // Calculate LOI (Length of Interview) in minutes
        const loi =
          entry.firstEnteredAt &&
          entry.finalOutcomeAt
            ? (
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

  // RETURN REPORT DATA
  return {
    projectSummaryData,
    respondentDetailsData
  }
}

// FUNCTION TO GENERATE PRESCREEN REPORT
export async function generatePrescreenReport() {
  return {
    reportType: "prescreen",
    status: "not_implemented",
    message:
      "Prescreen Report is currently on hold and not available for download.",
  };
}