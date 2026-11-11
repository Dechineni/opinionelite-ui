import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { validateDrakoAccess } from "@/lib/drako/validation";

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

// RETURN A SIMPLE USER-FRIENDLY ERROR PAGE
function unavailableResponse(
  message: string,
  status: number
) {
  const response = new NextResponse(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Survey Unavailable</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }

          .card {
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 1px 8px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
          }

          h1 {
            margin-bottom: 12px;
            color: #0f172a;
          }

          p {
            color: #475569;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Survey Unavailable</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>
    `,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );

  return addNoStoreHeaders(response);
}

// RETURN A SIMPLE USER-FRIENDLY ERROR MESSAGE
const UNAVAILABLE_MESSAGE = "This survey is currently unavailable. Thank you for your interest.";

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
      return unavailableResponse(
        UNAVAILABLE_MESSAGE,
        400
      );
    }

    // PREVENT PLACEHOLDER VALUES FROM BEING USED AS VALID PARAMETERS
    if (isPlaceholder(projectCode) || isPlaceholder(supplierCode)) {
      return unavailableResponse(
        UNAVAILABLE_MESSAGE,
        400
      );
    }

    const validation =
      await validateDrakoAccess(
        prisma,
        projectCode,
        supplierCode
      );

    if (!validation.valid) {
      return unavailableResponse(
        UNAVAILABLE_MESSAGE,
        "status" in validation
          ? validation.status
          : 403
      );
    }

    const project = validation.project;
    const supplier = validation.supplier;

    // GENERATE A UNIQUE RESPONDENT ID FOR THE SURVEY USER
    const respondentId = generateRespondentId();

    // GET THE APPLICATION BASE URL FOR BUILDING THE SURVEY LINK
    const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    // CREATE THE SURVEY URL FOR REDIRECTING THE USER
    const surveyUrl = new URL("/Survey",origin);

    // ADD THE PROJECT ID TO THE SURVEY URL
    surveyUrl.searchParams.set("projectId", project.code || project.id);

    // ADD THE SUPPLIER ID TO THE SURVEY URL
    surveyUrl.searchParams.set("supplierId", supplier.code);

    // ADD THE RESPONDENT ID TO THE SURVEY URL
    surveyUrl.searchParams.set("id", respondentId);

    // REDIRECT THE USER TO THE GENERATED SURVEY URL
    const response =
      NextResponse.redirect(
        surveyUrl.toString(),
        302
      )

    // RETURN THE REDIRECT RESPONSE WITH NO-CACHE HEADERS
    return addNoStoreHeaders(response);

  } catch (error) {
    // RETURN A SERVER ERROR RESPONSE WHEN REQUEST PROCESSING FAILS
    return unavailableResponse(
      UNAVAILABLE_MESSAGE,
      500
    );
  }
}