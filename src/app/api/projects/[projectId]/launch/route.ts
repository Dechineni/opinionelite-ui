// FILE: src/app/api/projects/[projectId]/launch/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

function hasUsableGender(value: string | null | undefined): boolean {
  const v = (value || "").trim().toLowerCase();
  return v === "male" || v === "female";
}

function hasUsableBirthDate(value: string | null | undefined): boolean {
  const v = (value || "").trim();
  if (!v) return false;

  // allow YYYY-MM-DD from query string
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;

  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const externalId = (url.searchParams.get("id") || "").trim();

  const birthDateFromQuery = (url.searchParams.get("birthDate") || "").trim();
  const genderFromQuery = (url.searchParams.get("gender") || "").trim();

  const fromPrescreen = url.searchParams.get("fromPrescreen") === "1";
  const fromSentry = url.searchParams.get("fromSentry") === "1";
  const sentryDone = url.searchParams.get("sentryDone") === "1";

  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: {
      id: true,
      code: true,
      preScreen: true,
      sentryEnabled: true,
      apiSurveySelection: {
        select: {
          id: true,
        },
      },
      client: {
        select: {
          providerType: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const projectKey = project.code || project.id;

  const isProviderBacked =
    !!project.apiSurveySelection?.id && !!project.client?.providerType;

  const qs = new URLSearchParams();

  if (supplierId) qs.set("supplierId", supplierId);
  if (externalId) qs.set("id", externalId);
  if (birthDateFromQuery) qs.set("birthDate", birthDateFromQuery);
  if (genderFromQuery) qs.set("gender", genderFromQuery);

  if (fromPrescreen) qs.set("fromPrescreen", "1");
  if (fromSentry) qs.set("fromSentry", "1");
  if (sentryDone) qs.set("sentryDone", "1");

  // =========================
  // STEP 1: PRESCREEN ROUTING
  // =========================

  const hasPrescreenQuestions = await prisma.prescreenQuestion.count({
    where: {
      projectId: project.id,
    },
  });

  if (project.preScreen && hasPrescreenQuestions > 0 && !fromPrescreen) {
    const prescreenUrl = new URL("/Prescreen", url.origin);

    prescreenUrl.searchParams.set("projectId", projectKey);

    if (supplierId) prescreenUrl.searchParams.set("supplierId", supplierId);
    if (externalId) prescreenUrl.searchParams.set("id", externalId);

    return NextResponse.redirect(prescreenUrl.toString(), 302);
  }

  // =========================
  // STEP 2: SENTRY ROUTING
  // =========================
  // Important:
  // Do not build the CloudResearch Sentry URL here.
  // Keep Sentry URL-building only inside /sentry-start.

  const shouldGoSentry = project.sentryEnabled && !sentryDone;

  if (shouldGoSentry) {
    const sentryStartUrl = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/sentry-start`,
      url.origin
    );

    if (supplierId) sentryStartUrl.searchParams.set("supplierId", supplierId);
    if (externalId) sentryStartUrl.searchParams.set("id", externalId);
    if (birthDateFromQuery) {
      sentryStartUrl.searchParams.set("birthDate", birthDateFromQuery);
    }
    if (genderFromQuery) {
      sentryStartUrl.searchParams.set("gender", genderFromQuery);
    }

    sentryStartUrl.searchParams.set("fromPrescreen", "1");

    return NextResponse.redirect(sentryStartUrl.toString(), 302);
  }

  // =========================
  // STEP 3: MANUAL PROJECT ROUTING
  // =========================
  // Manual projects must continue through /survey-live.
  // Do not redirect directly to project.surveyLiveUrl here.

  if (!isProviderBacked) {
    const target = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/survey-live`,
      url.origin
    );

    for (const [k, v] of qs.entries()) {
      target.searchParams.set(k, v);
    }

    return NextResponse.redirect(target.toString(), 302);
  }

  // =========================
  // STEP 4: RESPONDENT PROFILE CHECK
  // =========================
  // Provider-backed projects may need respondent profile before provider launch.
  // This must happen after Sentry, not before Sentry.

  let hasBirthDate = hasUsableBirthDate(birthDateFromQuery);
  let hasGender = hasUsableGender(genderFromQuery);

  if ((!hasBirthDate || !hasGender) && externalId) {
    const saved = await prisma.respondentLaunchProfile.findFirst({
      where: {
        projectId: project.id,
        supplierId: supplierId || null,
        externalId,
      },
      select: {
        birthDate: true,
        gender: true,
      },
    });

    if (saved) {
      if (!hasBirthDate && saved.birthDate) hasBirthDate = true;
      if (!hasGender && saved.gender) {
        hasGender = hasUsableGender(saved.gender);
      }
    }
  }

  if (!hasBirthDate || !hasGender) {
    const next = `/api/projects/${encodeURIComponent(projectKey)}/launch${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;

    const profileUrl = new URL("/respondent-profile", url.origin);

    profileUrl.searchParams.set("projectId", projectKey);

    if (supplierId) profileUrl.searchParams.set("supplierId", supplierId);
    if (externalId) profileUrl.searchParams.set("id", externalId);

    profileUrl.searchParams.set("next", next);

    return NextResponse.redirect(profileUrl.toString(), 302);
  }

  // =========================
  // STEP 5: PROVIDER-BACKED ROUTING
  // =========================

  const target = new URL(
    `/api/projects/${encodeURIComponent(projectKey)}/provider-launch`,
    url.origin
  );

  for (const [k, v] of qs.entries()) {
    target.searchParams.set(k, v);
  }

  return NextResponse.redirect(target.toString(), 302);
}