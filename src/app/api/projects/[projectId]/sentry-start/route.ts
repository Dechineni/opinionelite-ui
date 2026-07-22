export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const externalId = (url.searchParams.get("id") || "").trim();
  const recid = (url.searchParams.get("recid") || "").trim();

  const birthDate = (url.searchParams.get("birthDate") || "").trim();
  const gender = (url.searchParams.get("gender") || "").trim();

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
      sentryProjectId: true,
      sentryLiveUrl: true,
      sentryTestUrl: true,
      sentryProviderId: true,
      sentryIdField: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  const projectKey = project.code || project.id;

  // If Sentry is disabled, return to central launch flow.
  if (!project.sentryEnabled) {
    const launchUrl = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/launch`,
      url.origin
    );

    if (supplierId) launchUrl.searchParams.set("supplierId", supplierId);
    launchUrl.searchParams.set("id", externalId);

    if (recid) launchUrl.searchParams.set("recid", recid);

    if (birthDate) launchUrl.searchParams.set("birthDate", birthDate);
    if (gender) launchUrl.searchParams.set("gender", gender);

    launchUrl.searchParams.set("fromPrescreen", "1");

    return NextResponse.redirect(launchUrl.toString(), 302);
  }

  const baseSentryUrl = project.sentryLiveUrl || project.sentryTestUrl;

  if (!baseSentryUrl) {
    return NextResponse.json(
      { error: "Missing Sentry URL configuration" },
      { status: 400 }
    );
  }

  if (!project.sentryProjectId) {
    return NextResponse.json(
      { error: "Missing sentryProjectId in project" },
      { status: 400 }
    );
  }

  const sentryProviderId =
    project.sentryProviderId?.trim() ||
    process.env.SENTRY_PROVIDER_ID?.trim();

  if (!sentryProviderId) {
    return NextResponse.json(
      { error: "Missing Sentry providerId configuration" },
      { status: 400 }
    );
  }

  const sentryIdField =
    project.sentryIdField?.trim() ||
    process.env.SENTRY_ID_FIELD?.trim() ||
    "aid";

  const sentryUrl = new URL(baseSentryUrl);

  // CloudResearch providerId from Provider API, not our internal supplierId.
  sentryUrl.searchParams.set("providerId", sentryProviderId);

  // Respondent ID field. For current CloudResearch provider config, this is aid.
  sentryUrl.searchParams.set(sentryIdField, externalId);

  // Preserve context. These parameters should be forwarded back to our configured Sentry callback URL.
  if (supplierId) sentryUrl.searchParams.set("supplierId", supplierId);
  if (birthDate) sentryUrl.searchParams.set("birthDate", birthDate);
  if (gender) sentryUrl.searchParams.set("gender", gender);
  if (recid) sentryUrl.searchParams.set("recid", recid);

  return NextResponse.redirect(sentryUrl.toString(), 302);
}