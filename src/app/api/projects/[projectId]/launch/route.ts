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

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;

  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export async function GET(
  req: Request,
  ctx: { params: { projectId: string } }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);

  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const externalId = (url.searchParams.get("id") || "").trim();

  const birthDateFromQuery = (url.searchParams.get("birthDate") || "").trim();
  const genderFromQuery = (url.searchParams.get("gender") || "").trim();

const isFromSentry = url.searchParams.get("fromSentry") === "1";
const sentryDone = url.searchParams.get("sentryDone") === "1";

  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: {
      id: true,
      code: true,
      sentryEnabled: true,
      surveyLiveUrl: true,
      sentryLiveUrl: true,
      sentryTestUrl: true,
      sentryProjectId: true,
      apiSurveySelection: { select: { id: true } },
      client: { select: { providerType: true } },
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

  // =========================
  // STEP 1: PRESCREEN CHECK
  // =========================

  let hasBirthDate = hasUsableBirthDate(birthDateFromQuery);
  let hasGender = hasUsableGender(genderFromQuery);

  if ((!hasBirthDate || !hasGender) && externalId) {
    const saved = await prisma.respondentLaunchProfile.findFirst({
      where: {
        projectId: project.id,
        supplierId: supplierId || null,
        externalId,
      },
      select: { birthDate: true, gender: true },
    });

    if (saved) {
      if (!hasBirthDate && saved.birthDate) hasBirthDate = true;
      if (!hasGender && saved.gender) hasGender = hasUsableGender(saved.gender);
    }
  }

  // =========================
// STEP 1B: PRESCREEN ROUTING
// =========================

const hasPrescreenQuestions =
  await prisma.prescreenQuestion.count({
    where: {
      projectId: project.id,
    },
  });

const fromPrescreen =
  url.searchParams.get("fromPrescreen") === "1";

if (
  hasPrescreenQuestions > 0 &&
  !fromPrescreen
) {
  const prescreenUrl = new URL(
    "/prescreen",
    url.origin
  );

  prescreenUrl.searchParams.set(
    "projectId",
    projectKey
  );

  if (supplierId) {
    prescreenUrl.searchParams.set(
      "supplierId",
      supplierId
    );
  }

  if (externalId) {
    prescreenUrl.searchParams.set(
      "id",
      externalId
    );
  }

  return NextResponse.redirect(
    prescreenUrl.toString(),
    302
  );
}

  // =========================
  // STEP 2: SENTRY FLOW
  // =========================

  const shouldGoSentry =
    project.sentryEnabled && !isFromSentry && !sentryDone;

  if (shouldGoSentry) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || url.origin;

    const callback = new URL(
  `/api/projects/${encodeURIComponent(projectKey)}/sentry-callback`,
  baseUrl
);
    callback.searchParams.set("projectId", projectKey);
    if (supplierId) callback.searchParams.set("supplierId", supplierId);
    if (externalId) callback.searchParams.set("id", externalId);
    if (birthDateFromQuery) callback.searchParams.set("birthDate", birthDateFromQuery);
    if (genderFromQuery) callback.searchParams.set("gender", genderFromQuery);

    callback.searchParams.set("fromSentry", "1");
    callback.searchParams.set("sentryDone", "1");

    const sentryBase =
      project.sentryLiveUrl || project.sentryTestUrl;

    if (!sentryBase) {
      return NextResponse.json(
        { error: "Missing Sentry URL configuration" },
        { status: 400 }
      );
    }

    const sentryUrl = new URL(sentryBase);

    // Use CloudResearch providerId from env
const sentryProviderId =
  process.env.SENTRY_PROVIDER_ID?.trim();

if (!sentryProviderId) {
  return NextResponse.json(
    { error: "Missing SENTRY_PROVIDER_ID configuration" },
    { status: 500 }
  );
}

sentryUrl.searchParams.set(
  "providerId",
  sentryProviderId
);
    const sentryIdField =
  process.env.SENTRY_ID_FIELD?.trim() || "id";

sentryUrl.searchParams.set(
  sentryIdField,
  externalId
);

    sentryUrl.searchParams.set("return_url", callback.toString());

    return NextResponse.redirect(sentryUrl.toString(), 302);
  }

  // =========================
  // STEP 3: PROVIDER ROUTING
  // =========================

  if (isProviderBacked) {
    const target = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/provider-launch`,
      url.origin
    );

    for (const [k, v] of qs.entries()) {
      target.searchParams.set(k, v);
    }

    return NextResponse.redirect(target.toString(), 302);
  }

  // =========================
  // STEP 4: RESPONDENT PROFILE (FALLBACK AFTER SENTRY)
  // =========================

if ((!hasBirthDate || !hasGender) && !isFromSentry && !sentryDone) {
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
// STEP 5: SURVEY FALLBACK (FIXED)
// =========================

if (!project.surveyLiveUrl) {
  return NextResponse.json(
    { error: "Survey URL not configured." },
    { status: 400 }
  );
}

const liveUrl = project.surveyLiveUrl
  .replaceAll(
    "[identifier]",
    encodeURIComponent(externalId)
  )
  .replaceAll(
    "{identifier}",
    encodeURIComponent(externalId)
  );

const surveyUrl = new URL(liveUrl);

if (supplierId) {
  surveyUrl.searchParams.set("supplierId", supplierId);
}

if (externalId) {
  surveyUrl.searchParams.set("id", externalId);
}

surveyUrl.searchParams.set("pid", projectKey);

// preserve flow flags
surveyUrl.searchParams.set("fromPrescreen", "1");
surveyUrl.searchParams.set(
  "fromSentry",
  isFromSentry ? "1" : "0"
);

surveyUrl.searchParams.set(
  "sentryDone",
  sentryDone ? "1" : "0"
);

return NextResponse.redirect(surveyUrl.toString(), 302);
}