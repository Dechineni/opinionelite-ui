// src/app/api/reports/client/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import XLSX from "xlsx-js-style";

const DOWNLOAD_ROW_LIMIT = 1000;

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

    const pageParam = searchParams.get("page") ?? "1";
    const pageSizeParam = searchParams.get("pageSize") ?? "100";

    const page = Number(pageParam);
    const pageSize = Number(pageSizeParam);

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

    // VALIDATE PAGESIZES
    const allowedPageSizes = [50, 100, 250, 500];

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || !allowedPageSizes.includes(pageSize)) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    };

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

    // WHERE CONDITION FOR SUPPLIERENTRY
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

    // CALCULATE TOTAL PAGES
    const totalPages = Math.max(1,Math.ceil(totalRows / pageSize));

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // FOR DOWNLOADS, FETCH UP TO THE DOWNLOAD LIMIT.
    // FOR REPORT PREVIEW, FETCH ONLY THE CURRENT PAGE.
    const queryLimit = format === "xlsx" ? DOWNLOAD_ROW_LIMIT : take;

    // DOWNLOADS ALWAYS START FROM THE FIRST ROW.
    // REPORT PREVIEW USES PAGINATION OFFSET.
    const queryOffset = format === "xlsx" ? 0 : skip;

    // DON'T ALLOW EXCEL DOWNLOAD IF THERE ARE MORE THAN 1000 ROWS.
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
    const rawRows = await prisma.$queryRaw<any[]>`
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY se."firstEnteredAt" ASC, se.id ASC
        )::int AS "sNo",

        c.name AS "clientName",
        c.code AS "clientCode",

        p.code AS "projectCode",

        COALESCE(
            api."surveyName",
            p."surveyName",
            p.name
        ) AS "surveyName",

        COALESCE(sr.id, '') AS "hashIdentifier",

        se."supplierCode" AS "supplierId",

        COALESCE(s.name, '') AS "supplierName",

        se."externalId" AS "supplierIdentifier",

        se."finalOutcome",
        se."finalSource",

        se."firstEnteredAt" AS "startDateTime",
        se."finalOutcomeAt" AS "endDateTime",

        CASE
            WHEN se."firstEnteredAt" IS NOT NULL
            AND se."finalOutcomeAt" IS NOT NULL
            THEN ROUND(
                EXTRACT(
                    EPOCH FROM (
                        se."finalOutcomeAt" - se."firstEnteredAt"
                    )
                ) / 60
            )::int
            ELSE NULL
        END AS "loi"

    FROM "SupplierEntry" se

    JOIN "Project" p
      ON p.id = se."projectId"

    JOIN "Client" c
      ON c.id = p."clientId"

    LEFT JOIN "Supplier" s
      ON s.code = se."supplierCode"

    LEFT JOIN "ApiSurveySelection" api
      ON api."projectId" = p.id

   LEFT JOIN LATERAL (
      SELECT sr.id
      FROM "SurveyRedirect" sr
      WHERE sr."projectId" = se."projectId"
        AND sr."supplierId" = se."supplierCode"
        AND sr."externalId" = se."externalId"
      ORDER BY sr."createdAt" DESC
      LIMIT 1
    ) sr ON true

    WHERE
        p."clientId" = ${clientId}
        AND se."firstEnteredAt" >= ${fromDateStart}
        AND se."firstEnteredAt" < ${toDateExclusive}
        AND se."externalId" NOT IN ('', '[identifier]')

    ORDER BY
        se."firstEnteredAt" ASC,
        se.id ASC

    LIMIT ${queryLimit}
    OFFSET ${queryOffset}
    `;

    // CREATE REPORTROWS
    const reportRows = rawRows.map((row) => {
      const { finalOutcome, finalSource, ...reportRow } = row;

      return {
        ...reportRow,

        sNo:
          typeof row.sNo === "bigint"
            ? Number(row.sNo)
            : row.sNo,

        loi:
          row.loi == null
            ? ""
            : typeof row.loi === "bigint"
              ? Number(row.loi)
              : row.loi,

        statusDescription: getStatusDescription(
          finalOutcome,
          finalSource
        ),
      }
    });

    if (format === "json") {
      return NextResponse.json({
        success: true,
        status: 200,
        data: reportRows,
        rows: reportRows,
        page,
        pageSize,
        totalRows,
        totalPages
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
