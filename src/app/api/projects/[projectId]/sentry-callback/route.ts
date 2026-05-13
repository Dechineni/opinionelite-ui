export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

function buildTerminateUrl(origin: string) {
  return new URL("/Thanks?status=TERMINATE", origin);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const statusRaw =
    url.searchParams.get("sentry_status") ||
    url.searchParams.get("status") ||
    url.searchParams.get("result") ||
    "";

  const status = statusRaw.trim().toLowerCase();

  const supplierId = (url.searchParams.get("supplierId") || "").trim();

  // Sentry provider config uses idField=aid.
  // Keep fallback to id also, in case older URLs still return id.
  const externalId = (
    url.searchParams.get("aid") ||
    url.searchParams.get("id") ||
    ""
  ).trim();

  const birthDate = (url.searchParams.get("birthDate") || "").trim();
  const gender = (url.searchParams.get("gender") || "").trim();

  if (!projectId || !externalId) {
    return NextResponse.redirect(buildTerminateUrl(url.origin), 302);
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectId }, { code: projectId }],
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!project) {
    return NextResponse.redirect(buildTerminateUrl(url.origin), 302);
  }

  const projectKey = project.code || project.id;

  // Sentry docs:
  // 1 = Pass
  // 2 = Fail - Behavioral Interview
  // 3 = Fail - Tech Security Blocked
  const isPass = status === "1";
  const isFail = status === "2" || status === "3";

  if (isFail) {
    const terminateUrl = buildTerminateUrl(url.origin);

    terminateUrl.searchParams.set("projectId", projectKey);
    terminateUrl.searchParams.set("id", externalId);

    if (supplierId) {
      terminateUrl.searchParams.set("supplierId", supplierId);
    }

    terminateUrl.searchParams.set("fromSentry", "1");
    terminateUrl.searchParams.set("sentry_status", status);

    return NextResponse.redirect(terminateUrl.toString(), 302);
  }

  if (isPass) {
    const launchUrl = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/launch`,
      url.origin
    );

    launchUrl.searchParams.set("id", externalId);

    if (supplierId) {
      launchUrl.searchParams.set("supplierId", supplierId);
    }

    if (birthDate) {
      launchUrl.searchParams.set("birthDate", birthDate);
    }

    if (gender) {
      launchUrl.searchParams.set("gender", gender);
    }

    // Preserve routing state so launch route does not send user back to Prescreen/Sentry.
    launchUrl.searchParams.set("fromPrescreen", "1");
    launchUrl.searchParams.set("fromSentry", "1");
    launchUrl.searchParams.set("sentryDone", "1");
    launchUrl.searchParams.set("sentry_status", status);

    return NextResponse.redirect(launchUrl.toString(), 302);
  }

  // Missing or unknown sentry_status should not launch survey.
  const fallbackUrl = buildTerminateUrl(url.origin);

  fallbackUrl.searchParams.set("projectId", projectKey);
  fallbackUrl.searchParams.set("id", externalId);
  fallbackUrl.searchParams.set("fromSentry", "1");

  if (supplierId) {
    fallbackUrl.searchParams.set("supplierId", supplierId);
  }

  if (status) {
    fallbackUrl.searchParams.set("sentry_status", status);
  }

  return NextResponse.redirect(fallbackUrl.toString(), 302);
}