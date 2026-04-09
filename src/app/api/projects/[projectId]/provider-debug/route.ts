export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  fetchTolunaQuotas,
  type TolunaClientConfig,
} from "@/lib/providers/toluna";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { projectId } = await ctx.params;
    const url = new URL(req.url);

    const project = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: {
        id: true,
        code: true,
        countryCode: true,
        apiSurveySelection: {
          select: {
            id: true,
            surveyCode: true,
            quotaId: true,
            providerType: true,
          },
        },
        client: {
          select: {
            id: true,
            code: true,
            name: true,
            apiUrl: true,
            apiKey: true,
            memberApiUrl: true,
            refDataUrl: true,
            partnerAuthKey: true,
            partnerGuid: true,
            panelGuidEnUs: true,
            panelGuidEnGb: true,
            providerType: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (!project.apiSurveySelection?.id || !project.client) {
      return NextResponse.json(
        { error: "This project is not provider-backed." },
        { status: 400 }
      );
    }

    const providerType = String(
      project.apiSurveySelection.providerType || project.client.providerType || ""
    )
      .trim()
      .toLowerCase();

    if (providerType !== "toluna") {
      return NextResponse.json(
        { error: `Debug route is only implemented for toluna, got ${providerType || "unknown"}.` },
        { status: 400 }
      );
    }

    const client = {
      id: project.client.id,
      code: project.client.code,
      name: project.client.name,
      apiUrl: project.client.apiUrl,
      apiKey: project.client.apiKey,
      memberApiUrl: project.client.memberApiUrl,
      refDataUrl: project.client.refDataUrl,
      partnerAuthKey: project.client.partnerAuthKey,
      partnerGuid: project.client.partnerGuid,
      panelGuidEnUs: project.client.panelGuidEnUs,
      panelGuidEnGb: project.client.panelGuidEnGb,
    } satisfies TolunaClientConfig;

    const quotasJson = await fetchTolunaQuotas({
      client,
      countryCode: String(project.countryCode || "").trim().toUpperCase(),
    });

    const surveyCode = String(project.apiSurveySelection.surveyCode || "").trim();
    const quotaId = String(project.apiSurveySelection.quotaId || "").trim();

    const surveys = Array.isArray(quotasJson?.Surveys) ? quotasJson.Surveys : [];
    const survey =
      surveys.find((s: any) => String(s?.SurveyID ?? "") === surveyCode) || null;

    const quota =
      survey && Array.isArray(survey.Quotas)
        ? survey.Quotas.find((q: any) => String(q?.QuotaID ?? "") === quotaId) || null
        : null;

    return NextResponse.json({
      project: {
        id: project.id,
        code: project.code,
        countryCode: project.countryCode,
      },
      selection: {
        id: project.apiSurveySelection.id,
        providerType: project.apiSurveySelection.providerType,
        surveyCode,
        quotaId,
      },
      matchedSurveyFound: !!survey,
      matchedQuotaFound: !!quota,
      matchedSurvey: survey,
      matchedQuota: quota,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown provider-debug error";
    console.error("provider-debug error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}