export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import XLSX from "xlsx-js-style";

// CREATE RESPONDENT ROW INTERFACE
interface RespondentRow {
  serialNo: number;
  supplierId: string;
  supplierName: string;
  supplierIdentifier: string;
  projectCpi: number;
  supplierCpi: number | null;
  statusDescription: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  loi: string;
}

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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
    // GET PROJECT ID FROM ROUTE PARAMS
    const { projectId } = await ctx.params;

    // GET REPORT TYPE FROM QUERY PARAMETER 
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").trim();

    // SUPPORTED REPORT TYPES
    const supportedTypes = new Set([
      "project",
      "prescreen",
    ]);

    // CHECK IF REPORT TYPE IS VALID OR NOT
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

    // CHECK IF PROJECT ID IS AVAILABLE OR NOT
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

    // GENERATE REPORT BASED ON REPORT TYPE
    if (type === "project") {
      reportData = await generateProjectReport(projectId);

      // GETTING PROJECT SUMMARY REPORT DATA AND RESPONDENT DETAILS DATA
      const summary = reportData?.projectSummaryData;
      const respondents = reportData?.respondentDetailsData ?? [];

      // CREATE WORKBOOK
      const workbook = XLSX.utils.book_new();

      // COMMON STYLES
      const titleStyle = {
        font: {
          name: "Calibri",
          sz: 20,
          bold: true,
          color: { rgb: "0000CC" },
        },
      };

      const subTitleStyle = {
        font: {
          name: "Calibri",
          sz: 16,
          bold: true,
          color: { rgb: "0000CC" },
        },
      };

      const managerStyle = {
        font: {
          name: "Calibri",
          sz: 13,
          color: { rgb: "0000CC" },
        },
      };

      const headerStyle = {
        font: {
          bold: true,
          color: { rgb: "FFFFFF" },
          name: "Calibri",
        },
        fill: {
          fgColor: {
            rgb: "008080",
          },
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
        border: {
          top: { style: "thin", color: { rgb: "D9D9D9" } },
          bottom: { style: "thin", color: { rgb: "D9D9D9" } },
          left: { style: "thin", color: { rgb: "D9D9D9" } },
          right: { style: "thin", color: { rgb: "D9D9D9" } },
        },
      };

      const bodyStyle = {
        font: {
          name: "Calibri",
          sz: 11,
        },
        border: {
          top: { style: "thin", color: { rgb: "D9D9D9" } },
          bottom: { style: "thin", color: { rgb: "D9D9D9" } },
          left: { style: "thin", color: { rgb: "D9D9D9" } },
          right: { style: "thin", color: { rgb: "D9D9D9" } },
        },
      };

      // CREATE PROJECT SUMMARY SHEET
      const summarySheet = XLSX.utils.aoa_to_sheet([]);

      summarySheet["!sheetViews"] = [
        {
          showGridLines: false,
        },
      ];

      // ADD REPORT TITLE
      XLSX.utils.sheet_add_aoa(
        summarySheet,
        [["Project Report"]],
        {
          origin: "A1",
        }
      );

      summarySheet["A1"].s = titleStyle;

      // ADD PROJECT NAME AND SURVEY CODE 
      XLSX.utils.sheet_add_aoa(
        summarySheet,
        [[
          `Project Name : ${summary?.projectName} (Survey Code : ${summary?.surveyCode})`,
        ]],
        {
          origin: "A3",
        }
      );

      summarySheet["A3"].s = subTitleStyle;

      // ADD PROJECT MANAGER DETAILS
      XLSX.utils.sheet_add_aoa(
        summarySheet,
        [[`Project Manager : ${summary?.projectManager}`]],
        {
          origin: "A5",
        }
      );

      summarySheet["A5"].s = managerStyle;

      // MERGES
      summarySheet["!merges"] = [
        {
          s: { r: 0, c: 0 },
          e: { r: 0, c: 12 },
        },
        {
          s: { r: 2, c: 0 },
          e: { r: 2, c: 12 },
        },
        {
          s: { r: 4, c: 0 },
          e: { r: 4, c: 12 },
        },
      ];

      // ADD PROJECT SUMMARY HEADERS
      XLSX.utils.sheet_add_aoa(
        summarySheet,
        [["Respondent Status", "Count"]],
        {
          origin: "A7",
        }
      );

      summarySheet["A7"].s = headerStyle;
      summarySheet["B7"].s = headerStyle;

      // ADD SUMMARY DATA
      const summaryRows = [
        ["Entrants", summary?.entrants],
        ["In Progress", summary?.inProgress],
        ["Complete", summary?.complete],
        ["Terminate", summary?.terminate],
        ["Prescreener Terminate", summary?.prescreenTerminate],
        ["Over Quota", summary?.overQuota],
        ["Quality Terminate", summary?.qualityTerminate],
        ["Drop Out", summary?.dropOut],
        ["Total", summary?.total],
      ];

      XLSX.utils.sheet_add_aoa(
        summarySheet,
        summaryRows,
        {
          origin: "A8",
        }
      );

      // APPLY STYLES TO PROJECT SUMMARY ROWS
      for (let row = 8; row < 8 + summaryRows.length; row++) {
        const colA = `A${row}`;
        const colB = `B${row}`;

        if (summarySheet[colA]) {
          summarySheet[colA].s = {
            ...bodyStyle,
            alignment: {
              horizontal: "left",
            },
          };
        }

        if (summarySheet[colB]) {
          summarySheet[colB].s = {
            ...bodyStyle,
            alignment: {
              horizontal: "right",
            },
          };
        }
      }

      // SET COLUMN WIDTHS
      summarySheet["!cols"] = [
        { wch: 30 },
        { wch: 15 },
      ];

      // SET ROW HEIGHTS
      summarySheet["!rows"] = [];

      summarySheet["!rows"][0] = {
        hpt: 34,
      };

      summarySheet["!rows"][2] = {
        hpt: 30,
      };

      summarySheet["!rows"][4] = {
        hpt: 26,
      };

      summarySheet["!rows"][6] = {
        hpt: 24,
      };

      for (let i = 7; i < 17; i++) {
        summarySheet["!rows"][i] = {
          hpt: 22,
        };
      }

      // CREATE RESPONDENT DETAILS SHEET
      const respondentSheet = XLSX.utils.aoa_to_sheet([]);

      respondentSheet["!sheetViews"] = [
        {
          showGridLines: false,
        },
      ];

      // ADD COLUMN HEADERS
      const respondentHeaders = [[
        "S.No.",
        "Supplier Id",
        "Supplier Name",
        "Supplier Identifier",
        "Project CPI",
        "Supplier CPI",
        "Status Description",
        "Start Date Time",
        "End Date Time",
        "LOI",
      ]];

      XLSX.utils.sheet_add_aoa(
        respondentSheet,
        respondentHeaders,
        {
          origin: "A2",
        }
      );

      // APPLY HEADER STYLE
      const headerRowCells = [
        "A2",
        "B2",
        "C2",
        "D2",
        "E2",
        "F2",
        "G2",
        "H2",
        "I2",
        "J2",
      ];

      headerRowCells.forEach((cell) => {
        if (respondentSheet[cell]) {
          respondentSheet[cell].s = headerStyle;
        }
      });

      // FORMATE DATA FOR EXCEL REPORT
      const formatDate = (
        value: Date | null
      ) => {
        if (!value) return "";

        const d = new Date(value);

        return (
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0") +
          " " +
          String(d.getHours()).padStart(2, "0") +
          ":" +
          String(d.getMinutes()).padStart(2, "0") +
          ":" +
          String(d.getSeconds()).padStart(2, "0")
        );
      };

      // PREPARE RESPONDENT DETAILS ROWS
      const respondentRows = respondents.map(
      (item: RespondentRow) => [
        item.serialNo,
        item.supplierId,
        item.supplierName,
        item.supplierIdentifier ?? "",
        Number(item.projectCpi ?? 0),
        Number(item.supplierCpi ?? 0),
        item.statusDescription,
        formatDate(item.startDateTime),
        formatDate(item.endDateTime),
        Number(item.loi ?? 0),
      ]
    );

      XLSX.utils.sheet_add_aoa(
        respondentSheet,
        respondentRows,
        {
          origin: "A3",
        }
      );

      // RANGE
      const range = XLSX.utils.decode_range(
        respondentSheet["!ref"]!
      );

      // STYLE BODY ROWS
      for (let row = 2; row <= range.e.r; row++) {
        for (let col = 0; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({
            r: row,
            c: col,
          });

          if (respondentSheet[cellAddress]) {
            respondentSheet[cellAddress].s = {
              ...bodyStyle,
              alignment: {
                horizontal: "center",
                vertical: "center",
                wrapText: true,
              },
            };
          }
        }
      }

      // FORMAT COLUMNS
      for (let row = 3; row <= range.e.r + 1; row++) {
        // Supplier Identifier (Text)
        if (respondentSheet[`D${row}`]) {
          respondentSheet[`D${row}`].t = "s";
        }

        // Project CPI
        if (respondentSheet[`E${row}`]) {
          respondentSheet[`E${row}`].z = "0.00";
        }

        // Supplier CPI
        if (respondentSheet[`F${row}`]) {
          respondentSheet[`F${row}`].z = "0.00";
        }

        // LOI
        if (respondentSheet[`J${row}`]) {
          respondentSheet[`J${row}`].z = "0";
        }
      }

      // REAPPLY HEADER STYLE
      headerRowCells.forEach((cell) => {
        if (respondentSheet[cell]) {
          respondentSheet[cell].s = headerStyle;
        }
      });

      // FILTERS
      respondentSheet["!autofilter"] = {
        ref: "A2:J2",
      };

      // FREEZE HEADER
      respondentSheet["!freeze"] = {
        xSplit: 0,
        ySplit: 2,
      };

      // COLUMN WIDTHS
      respondentSheet["!cols"] = [
        { wch: 10 }, // S.No
        { wch: 15 }, // Supplier Id
        { wch: 25 }, // Supplier Name
        { wch: 45 }, // Supplier Identifier
        { wch: 15 }, // Project CPI
        { wch: 15 }, // Supplier CPI
        { wch: 25 }, // Status Description
        { wch: 22 }, // Start Date Time
        { wch: 22 }, // End Date Time
        { wch: 12 }, // LOI
      ];

      // ROW HEIGHTS
      respondentSheet["!rows"] = [];

      // Header Row (Excel Row 2)
      respondentSheet["!rows"][1] = {
        hpt: 28,
      };

      // Data Rows Start At Excel Row 3
      for (let i = 2; i < respondents.length + 2; i++) {
        respondentSheet["!rows"][i] = {
          hpt: 22,
        };
      }

      // APPEND SHEETS
      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Project Summary"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        respondentSheet,
        "Respondent Details"
      );

      // GENERATE EXCEL
      const excelArray = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      return new NextResponse(excelArray, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            `attachment; filename="ProjectReport_${summary?.surveyCode}.xlsx"`,
        },
      });
    }

    if (type === "prescreen") {
      reportData =
        await generatePrescreenReport();

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
        message:
          error instanceof Error
            ? error.message
            : "Internal server error",
        data: null,
      },
      {
        status: 500,
      }
    );
  }
}
