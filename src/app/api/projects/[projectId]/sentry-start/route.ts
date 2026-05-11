export const runtime = "edge";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const supplierId = url.searchParams.get("supplierId") || "";
  const externalId = url.searchParams.get("id") || "";

  if (!externalId) {
    return NextResponse.redirect(
      new URL("/Thanks?status=TERMINATE", url.origin),
      302
    );
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectId }, { code: projectId }],
    },
    select: {
      id: true,
      code: true,
      sentryEnabled: true,
      surveyLiveUrl: true,
      sentryProjectId: true,
      sentryLiveUrl: true,
      sentryTestUrl: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  const projectKey = project.code || project.id;

  // =====================================
  // IF SENTRY DISABLED → DIRECT LAUNCH
  // =====================================

  if (!project.sentryEnabled) {
    const target = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/launch`,
      url.origin
    );

    if (supplierId) {
      target.searchParams.set("supplierId", supplierId);
    }

    target.searchParams.set("id", externalId);

    return NextResponse.redirect(target, 302);
  }

  // =====================================
  // SENTRY FLOW
  // =====================================

  const callbackUrl = new URL(
    `/api/projects/${encodeURIComponent(projectKey)}/sentry-callback`,
    url.origin
  );

  callbackUrl.searchParams.set("projectId", projectKey);

  if (supplierId) {
    callbackUrl.searchParams.set("supplierId", supplierId);
  }

  callbackUrl.searchParams.set("id", externalId);
  callbackUrl.searchParams.set("fromSentry", "1");

  // =====================================
  // GET SENTRY BASE URL
  // =====================================

  const baseSentryUrl =
    project.sentryLiveUrl || project.sentryTestUrl;

  if (!baseSentryUrl) {
    return NextResponse.json(
      { error: "Missing Sentry URL configuration" },
      { status: 400 }
    );
  }

  // =====================================
  // VALIDATE REQUIRED CONFIG
  // =====================================

  if (!project.sentryProjectId) {
    return NextResponse.json(
      { error: "Missing sentryProjectId in project" },
      { status: 400 }
    );
  }

  if (!process.env.SENTRY_PROVIDER_ID) {
    return NextResponse.json(
      { error: "Missing SENTRY_PROVIDER_ID env configuration" },
      { status: 400 }
    );
  }

  // =====================================
  // BUILD FINAL SENTRY URL
  // =====================================

  const sentryUrl = new URL(baseSentryUrl);

  // CORRECT FIX:
  // providerId MUST come from CloudResearch provider API
  // NOT from internal supplierId
  sentryUrl.searchParams.set(
    "providerId",
    process.env.SENTRY_PROVIDER_ID
  );

  // respondent external id
  const sentryIdField =
  process.env.SENTRY_ID_FIELD?.trim() || "aid";

sentryUrl.searchParams.set(
  sentryIdField,
  externalId
);

  // sentry callback url
  sentryUrl.searchParams.set(
    "return_url",
    callbackUrl.toString()
  );



  return NextResponse.redirect(sentryUrl, 302);
}