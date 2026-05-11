export const runtime = "edge";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: { projectId: string } }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const statusRaw =
    url.searchParams.get("sentry_status") ||
    url.searchParams.get("status") ||
    url.searchParams.get("result");


  const status = (statusRaw || "").toLowerCase();

  const supplierId = url.searchParams.get("supplierId") || "";
  const externalId = 
    url.searchParams.get("id") ||
    url.searchParams.get("aid") || "";

  // STEP 1 — Validate required params
  if (!projectId || !externalId.trim()) {

return NextResponse.redirect(
  new URL("/Thanks?status=TERMINATE", url.origin),
  302
);
  }

  // STEP 2 — Resolve project
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: {
      id: true,
      code: true,
      surveyLiveUrl: true,
      apiSurveySelection: {
        select: { id: true },
      },
      client: {
        select: { providerType: true },
      },
    },
  });

  if (!project) {
    return NextResponse.redirect(
      new URL("/Thanks?status=TERMINATE", url.origin),
      302
    );
  }

  const projectKey = project.code || project.id;

  // =========================
// SENTRY STATUS CHECK (FINAL)
// =========================

const isPass = status === "1";

const isFail = status === "2" || status === "3";
  // STEP 3 — FAIL → TERMINATE
  if (isFail) {
  const SENTRY_TERMINATION_URL = process.env.SENTRY_TERMINATION_URL;

  if (SENTRY_TERMINATION_URL) {
    let urlObj: URL;

try {
  urlObj = new URL(SENTRY_TERMINATION_URL);
} catch {
  return NextResponse.redirect(
    new URL("/Thanks?status=TERMINATE", url.origin),
    302
  );
}

    if (supplierId) urlObj.searchParams.set("supplierId", supplierId);
    urlObj.searchParams.set("id", externalId);

    return NextResponse.redirect(urlObj.toString(), 302);
  }

  return NextResponse.redirect(
    new URL("/Thanks?status=TERMINATE", url.origin),
    302
  );
}

// STEP 4 — PASS → CONTINUE FLOW
if (isPass) {

  // =====================================
// PASS → RETURN TO CENTRAL LAUNCH FLOW
// =====================================

const launchUrl = new URL(
    `/api/projects/${encodeURIComponent(projectKey)}/launch`,
    url.origin
  );

if (supplierId) {
  launchUrl.searchParams.set(
    "supplierId",
    supplierId
  );
}

launchUrl.searchParams.set(
  "id",
  externalId
);

// preserve flow state
launchUrl.searchParams.set(
  "fromPrescreen",
  "1"
);

launchUrl.searchParams.set(
  "fromSentry",
  "1"
);

launchUrl.searchParams.set(
  "sentryDone",
  "1"
);

return NextResponse.redirect(
  launchUrl.toString(),
  302
);

}

// =====================================
  // SAFE FALLBACK
  // =====================================

  return NextResponse.redirect(
    new URL("/Thanks?status=TERMINATE", url.origin),
    302
  );
}