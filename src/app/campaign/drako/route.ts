import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// READ THE CONFIGURED DRAKO SUPPLIER CODE FROM ENVIRONMENT SETTINGS
const DRAKO_SUPPLIER_CODE = process.env.NEXT_PUBLIC_DRAKO_SUPPLIER_CODE;

// GENERATE A UNIQUE RESPONDENT ID FOR EACH SURVEY RESPONSE
function generateRespondentId(): string {
  // CREATE 16 RANDOM BYTES FOR ID GENERATION
  const bytes = crypto.getRandomValues(
    new Uint8Array(16)
  );

  // CONVERT RANDOM BYTES INTO A HEXADECIMAL STRING
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Return ID with DRK prefix for identification
  return `DRK-${hex}`;
}

// ADD HEADERS TO PREVENT API RESPONSE CACHING
function addNoStoreHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

// CHECK IF THE IDENTIFIER VALUE IS EMPTY OR CONTAINS A PLACEHOLDER VALUE
function isPlaceholder(value: string | null): boolean {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();

  return (
    normalized === "[identifier]" ||
    normalized === "{identifier}" ||
    normalized === "identifier"
  );
}

// VALIDATE REQUIRED QUERY PARAMETERS BEFORE PROCESSING THE REQUEST
export async function GET(request: NextRequest) {
  try {

    // GET DATABASE INSTANCE AND READ QUERY PARAMETERS FROM THE REQUEST
    const prisma = getPrisma();

    const { searchParams } = new URL(request.url);

    const projectCode = searchParams.get("projectId");
    const supplierCode = searchParams.get("supplierId");

    // RETURN ERROR IF PROJECTID OR SUPPLIERID IS MISSING
    if (!projectCode || !supplierCode) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "projectId and supplierId are required",
          },
          {
            status: 400,
          }
        )
      );
    }

    // PREVENT PLACEHOLDER VALUES FROM BEING USED AS VALID PARAMETERS
    if (isPlaceholder(projectCode) || isPlaceholder(supplierCode)) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Invalid parameters",
          },
          {
            status: 400,
          }
        )
      );
    }

    // FIND THE PROJECT USING THE PROVIDED PROJECT CODE
    const project = await prisma.project.findUnique({
      where: {
        code: projectCode,
      },
    });

    // RETURN AN ERROR IF THE PROJECT DOES NOT EXIST
    if (!project) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Project not found",
          },
          {
            status: 404,
          }
        )
      );
    }

    // ALLOW REQUESTS ONLY FOR ACTIVE PROJECTS
    if (project.status !== "ACTIVE") {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Project is not accepting traffic",
          },
          {
            status: 403,
          }
        )
      );
    }

    // FAIL THE REQUEST IF DRAKO SUPPLIER CODE IS NOT CONFIGURED
    if (!DRAKO_SUPPLIER_CODE) {
    return addNoStoreHeaders(
      NextResponse.json(
        {
          error: "DRAKO supplier configuration is missing",
        },
        {
          status: 500,
        }
      )
    );
  }

    // FIND THE SUPPLIER USING THE PROVIDED SUPPLIER CODE
    const supplier = await prisma.supplier.findUnique({
      where: {
        code: supplierCode,
      },
    });

    // RETURN AN ERROR IF THE SUPPLIER DOES NOT EXIST
    if (!supplier) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Supplier not found",
          },
          {
            status: 404,
          }
        )
      );
    }

    // ENSURE THE SUPPLIER IS CONFIGURED AS DRAKO
    if (supplier.code !== DRAKO_SUPPLIER_CODE) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Supplier is not configured as DRAKO",
          },
          {
            status: 403,
          }
        )
      );
    }

    // FIND THE MAPPING BETWEEN THE PROJECT AND SUPPLIER
    const mapping =
      await prisma.projectSupplierMap.findUnique({
        where: {
          projectId_supplierId: {
            projectId: project.id,
            supplierId: supplier.id,
          },
        },
    });

    // RETURN AN ERROR IF NO PROJECT-SUPPLIER MAPPING EXISTS
    if (!mapping) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Project supplier mapping not found",
          },
          {
            status: 403,
          }
        )
      );
    }

    // BLOCK REQUESTS WHEN TRAFFIC IS DISABLED FOR THIS PROJECT-SUPPLIER MAPPING
    if (!mapping.allowTraffic) {
      return addNoStoreHeaders(
        NextResponse.json(
          {
            error: "Traffic is disabled for this mapping",
          },
          {
            status: 403,
          }
        )
      );
    }

    // GENERATE A UNIQUE RESPONDENT ID FOR THE SURVEY USER
    const respondentId = generateRespondentId();

    // GET THE APPLICATION BASE URL FOR BUILDING THE SURVEY LINK
    const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    // CREATE THE SURVEY URL FOR REDIRECTING THE USER
    const surveyUrl = new URL("/Survey",origin);

    // ADD THE PROJECT ID TO THE SURVEY URL
    surveyUrl.searchParams.set("projectId", project.code);

    // ADD THE SUPPLIER ID TO THE SURVEY URL
    surveyUrl.searchParams.set("supplierId", supplier.code);

    // ADD THE RESPONDENT ID TO THE SURVEY URL
    surveyUrl.searchParams.set("id", respondentId);

    // REDIRECT THE USER TO THE GENERATED SURVEY URL
    const response =
      NextResponse.redirect(
        surveyUrl.toString(),
        302
      );

    // RETURN THE REDIRECT RESPONSE WITH NO-CACHE HEADERS
    return addNoStoreHeaders(response);

  } catch (error) {
    // RETURN A SERVER ERROR RESPONSE WHEN REQUEST PROCESSING FAILS
    return addNoStoreHeaders(
      NextResponse.json(
        {
          error: "Unable to process request",
        },
        {
          status: 500,
        }
      )
    );
  }
}