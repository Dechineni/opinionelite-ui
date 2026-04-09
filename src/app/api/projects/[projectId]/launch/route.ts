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

  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: {
      id: true,
      code: true,
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

  if (!isProviderBacked) {
    const target = new URL(
      `/api/projects/${encodeURIComponent(projectKey)}/survey-live`,
      url.origin
    );
    for (const [k, v] of qs.entries()) target.searchParams.set(k, v);
    return NextResponse.redirect(target, 302);
  }

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
      if (!hasGender && saved.gender) hasGender = hasUsableGender(saved.gender);
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

    return NextResponse.redirect(profileUrl, 302);
  }

  // Phase C:
  // Provider-backed projects still continue to survey-live once the profile exists.
  // In Phase D this will redirect to /provider-launch instead.
  const target = new URL(
    `/api/projects/${encodeURIComponent(projectKey)}/survey-live`,
    url.origin
  );
  for (const [k, v] of qs.entries()) target.searchParams.set(k, v);

  return NextResponse.redirect(target, 302);
}