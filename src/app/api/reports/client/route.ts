// src/app/api/reports/client/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import XLSX from "xlsx-js-style";

const PREVIEW_ROW_LIMIT = 5000;
const DOWNLOAD_ROW_LIMIT = 5000;

// FOR STATUS DESCRIPTION
function getStatusDescription(
  finalOutcome: string | null,
  finalSource: string | null
) {
  if (!finalOutcome) {
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

  return finalOutcome;
}

export async function GET(req: Request) {
  try {
    // GET THE COOKIE STORE FROM THE INCOMING REQUEST
    const cookieStore = await cookies();

    // GET OE_AUTH TOKEN VALUE
    const token = cookieStore.get("OE_AUTH")?.value;

    // VALIDATE TOKEN IF NO TOKEN RETURN UNAUTHORIZED
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // INITIALIZE PRISMA CLIENT
    const prisma = getPrisma();

    // GET ALL PARAMS LIKE CLIENTID, FROMDATE, TODATE AND FORMAT
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") ?? "json";

    // VALIDATE FORMAT EARLY
    const allowedFormats = ["json", "xlsx"];

    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        {
          error: "Invalid format. Supported formats are json and xlsx",
        },
        {
          status: 400,
        }
      );
    }

    // VALIDATE CLIENTID IF NO CLIENTID RETURN CLIENTID IS REQUIRED
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // VALIDATE FROMDATE IF NO FROMDATE RETURN FROMDATE IS REQUIRED
    if (!from) {
      return NextResponse.json(
        { error: "from date is required" },
        { status: 400 }
      );
    }

    // VALIDATE TODATE IF NO TODATE RETURN TODATE IS REQUIRED
    if (!to) {
      return NextResponse.json(
        { error: "to date is required" },
        { status: 400 }
      );
    }

    // FORMATING AND VALIDATING DATE
    const fromDateStart = new Date(from);
    const toDate = new Date(to);

    if (
      isNaN(fromDateStart.getTime()) ||
      isNaN(toDate.getTime())
    ) {
      return NextResponse.json(
        { error: "invalid date format" },
        { status: 400 }
      );
    }

    if (toDate < fromDateStart) {
      return NextResponse.json(
        { error: "to date cannot be before from date" },
        { status: 400 }
      );
    }

    fromDateStart.setHours(0, 0, 0, 0);

    const toDateExclusive = new Date(toDate);
    toDateExclusive.setDate(toDateExclusive.getDate() + 1);
    toDateExclusive.setHours(0, 0, 0, 0);

    // GET CLIENT DATA
    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    // VALIDATE CLIENT IF NO CLIENT RETURN CLIENT NOT FOUND
    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const supplierEntryWhere = {
      firstEnteredAt: {
        gte: fromDateStart,
        lt: toDateExclusive,
      },
      project: {
        clientId,
      },
      AND: [
        { externalId: { not: "" } },
        { externalId: { not: "[identifier]" } },
      ],
    };

    // COUNT FIRST TO AVOID LOADING VERY LARGE REPORTS INTO API/UI
    const totalRows = await prisma.supplierEntry.count({
      where: supplierEntryWhere,
    });

    const previewMessage =
      totalRows > DOWNLOAD_ROW_LIMIT
        ? `This report has ${totalRows.toLocaleString()} rows and is too large to preview or download online. Please select a smaller date range.`
        : `This report has ${totalRows.toLocaleString()} rows and is too large to preview. Please use Download or select a smaller date range.`;

    if (format === "json" && totalRows > PREVIEW_ROW_LIMIT) {
      return NextResponse.json({
        success: true,
        status: 200,
        data: [],
        rows: [],
        totalRows,
        tooLargeForPreview: true,
        tooLargeForDownload: totalRows > DOWNLOAD_ROW_LIMIT,
        message: previewMessage,
      });
    }

    if (format === "xlsx" && totalRows > DOWNLOAD_ROW_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          status: 413,
          totalRows,
          tooLargeForDownload: true,
          error: `This report has ${totalRows.toLocaleString()} rows and is too large to generate online. Please select a smaller date range.`,
        },
        { status: 413 }
      );
    }

    // GET SUPPLIERENTRIES DATA BELONGS TO PROJECT CLIENTID AND INCLUDE PROJECT AND APISURVEYSELECTION
    const supplierEntries = await prisma.supplierEntry.findMany({
      where: supplierEntryWhere,
      include: {
        project: {
          include: {
            apiSurveySelection: true,
          },
        },
      },
      orderBy: {
        firstEnteredAt: "asc",
      },
    });

    // GET UNIQUE SUPPLIER CODES FROM SUPPLIER ENTRIES
    const supplierCodes = [
      ...new Set(
        supplierEntries.map(
          (entry) => entry.supplierCode
        )
      ),
    ];

    // GET UNIQUE PROJECT IDS FROM SUPPLIER ENTRIES
    const projectIds = [
      ...new Set(
        supplierEntries.map(
          (entry) => entry.projectId
        )
      ),
    ];

    // GET UNIQUE EXTERNAL IDS FROM SUPPLIER ENTRIES
    const externalIds = [
      ...new Set(
        supplierEntries
          .map((entry) => entry.externalId)
          .filter(
            (externalId): externalId is string =>
              Boolean(externalId)
          )
      ),
    ];

    // FETCH ALL REQUIRED SUPPLIERS IN ONE QUERY
    const suppliers = supplierCodes.length
      ? await prisma.supplier.findMany({
          where: {
            code: {
              in: supplierCodes,
            },
          },
        })
      : [];

    // CREATE A LOOKUP MAP FOR FAST SUPPLIER ACCESS
    const supplierMap = new Map(
      suppliers.map((supplier) => [
        supplier.code,
        supplier,
      ])
    );

    // FETCH ALL REQUIRED SURVEY REDIRECTS IN ONE QUERY
    const surveyRedirects =
      projectIds.length && supplierCodes.length && externalIds.length
        ? await prisma.surveyRedirect.findMany({
            where: {
              projectId: {
                in: projectIds,
              },
              supplierId: {
                in: supplierCodes,
              },
              externalId: {
                in: externalIds,
              },
            },
          })
        : [];

    // CREATE A LOOKUP MAP FOR FAST SURVEY REDIRECT ACCESS
    const surveyRedirectMap = new Map(
      surveyRedirects.map((redirect) => [
        `${redirect.projectId}_${redirect.supplierId}_${redirect.externalId}`,
        redirect,
      ])
    );

    // CREATE REPORTROWS
    const reportRows = supplierEntries.map(
      (entry, index) => {
        const supplier = supplierMap.get(
          entry.supplierCode
        );

        const surveyRedirect =
          surveyRedirectMap.get(
            `${entry.projectId}_${entry.supplierCode}_${entry.externalId}`
          );

        const surveyName =
          entry.project.apiSurveySelection
            ?.surveyName ||
          entry.project.surveyName ||
          entry.project.name;

        const statusDescription =
          getStatusDescription(
            entry.finalOutcome,
            entry.finalSource
          );

        let loi: number | string = "";

        if (
          entry.firstEnteredAt &&
          entry.finalOutcomeAt
        ) {
          loi = Math.round(
            (entry.finalOutcomeAt.getTime() -
              entry.firstEnteredAt.getTime()) /
              60000
          );
        }

        return {
          sNo: index + 1,

          clientName: client.name,
          clientCode: client.code,

          projectCode: entry.project.code,

          surveyName,

          hashIdentifier:
            surveyRedirect?.id ?? "",

          supplierId: entry.supplierCode,

          supplierName:
            supplier?.name ?? "",

          supplierIdentifier:
            entry.externalId,

          statusDescription,

          startDateTime:
            entry.firstEnteredAt,

          endDateTime:
            entry.finalOutcomeAt,

          loi,
        };
      }
    );

    if (format === "json") {
      return NextResponse.json({
        success: true,
        status: 200,
        data: reportRows,
        rows: reportRows,
        totalRows,
      });
    }

    if (format === "xlsx") {
      const headerStyle = {
        font: {
          bold: true,
          color: { rgb: "FFFFFF" },
        },
        fill: {
          fgColor: { rgb: "1F4E78" },
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };

      const bodyStyle = {
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: true,
        },
      };

      const workbook = XLSX.utils.book_new();

      const clientReportSheet = XLSX.utils.aoa_to_sheet([]);

      clientReportSheet["!sheetViews"] = [
        {
          showGridLines: false,
        },
      ];

      // HEADERS
      const headers = [[
        "S.No.",
        "Client Name",
        "Client Code",
        "Project Code",
        "Survey Name",
        "Hash Identifier",
        "Supplier Id",
        "Supplier Name",
        "Supplier Identifier",
        "Status Description",
        "Start Date Time",
        "End Date Time",
        "LOI",
      ]];

      XLSX.utils.sheet_add_aoa(
        clientReportSheet,
        headers,
        {
          origin: "A1",
        }
      );

      // HEADER STYLE
      const headerCells = [
        "A1", "B1", "C1", "D1", "E1", "F1",
        "G1", "H1", "I1", "J1", "K1", "L1", "M1",
      ];

      headerCells.forEach((cell) => {
        if (clientReportSheet[cell]) {
          clientReportSheet[cell].s = headerStyle;
        }
      });

      // DATE FORMATTER
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

      // DATA ROWS
      const rows = reportRows.map((item) => [
        item.sNo,
        item.clientName,
        item.clientCode,
        item.projectCode,
        item.surveyName,
        item.hashIdentifier,
        item.supplierId,
        item.supplierName,
        item.supplierIdentifier,
        item.statusDescription,
        formatDate(item.startDateTime),
        formatDate(item.endDateTime),
        item.loi,
      ]);

      XLSX.utils.sheet_add_aoa(
        clientReportSheet,
        rows,
        {
          origin: "A2",
        }
      );

      // RANGE
      const range = XLSX.utils.decode_range(
        clientReportSheet["!ref"]!
      );

      // BODY STYLE
      for (let row = 1; row <= range.e.r; row++) {
        for (let col = 0; col <= range.e.c; col++) {
          const address =
            XLSX.utils.encode_cell({
              r: row,
              c: col,
            });

          if (clientReportSheet[address]) {
            clientReportSheet[address].s = {
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

      // REAPPLY HEADER STYLE
      headerCells.forEach((cell) => {
        if (clientReportSheet[cell]) {
          clientReportSheet[cell].s =
            headerStyle;
        }
      });

      // FILTERS
      clientReportSheet["!autofilter"] = {
        ref: "A1:M1",
      };

      // COLUMN WIDTHS
      clientReportSheet["!cols"] = [
        { wch: 10 }, // S.No
        { wch: 25 }, // Client Name
        { wch: 15 }, // Client Code
        { wch: 18 }, // Project Code
        { wch: 35 }, // Survey Name
        { wch: 25 }, // Hash Identifier
        { wch: 15 }, // Supplier Id
        { wch: 25 }, // Supplier Name
        { wch: 30 }, // Supplier Identifier
        { wch: 22 }, // Status
        { wch: 22 }, // Start Time
        { wch: 22 }, // End Time
        { wch: 10 }, // LOI
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        clientReportSheet,
        "Client Report"
      );

      const excelArray = XLSX.write(
        workbook,
        {
          bookType: "xlsx",
          type: "array",
        }
      );

      return new NextResponse(excelArray, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            `attachment; filename="ClientReport_${client.code}_${from}_to_${to}.xlsx"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid format. Supported formats are json and xlsx" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Client Report API failed:", err);

    return NextResponse.json(
      {
        error: "Failed to load client report data",
        detail: String(err?.message ?? err),
      },
      {
        status: 500,
      }
    );
  }
}
