// FILE: src/app/api/projects/[projectId]/provider-launch/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  ensureTolunaMember,
  generateTolunaInvite,
  type TolunaClientConfig,
} from "@/lib/providers/toluna";

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeGender(value: string): "Male" | "Female" | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "male") return "Male";
  if (v === "female") return "Female";
  return null;
}

function id20(): string {
  const abc =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(20);

  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    typeof (globalThis as any).crypto.getRandomValues === "function"
  ) {
    (globalThis as any).crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return s;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
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
        countryCode: true,
        apiSurveySelection: {
          select: {
            id: true,
            quotaId: true,
            providerType: true,
          },
        },
        client: {
          select: {
            id: true,
            code: true,
            name: true,
            providerType: true,
            apiUrl: true,
            apiKey: true,
            memberApiUrl: true,
            refDataUrl: true,
            partnerAuthKey: true,
            partnerGuid: true,
            panelGuidEnUs: true,
            panelGuidEnGb: true,
            panelGuidEnCa: true,
            panelGuidEnIn: true,
            panelGuidPtBr: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (!project.apiSurveySelection?.id || !project.client?.providerType) {
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
        {
          error: `Provider launch is not implemented for ${
            providerType || "unknown provider"
          }.`,
        },
        { status: 400 }
      );
    }

    if (!externalId) {
      return NextResponse.json(
        { error: "Respondent identifier is required." },
        { status: 400 }
      );
    }

    let birthDate = isValidDateOnly(birthDateFromQuery) ? birthDateFromQuery : "";
    let gender = normalizeGender(genderFromQuery);

    if (!birthDate || !gender) {
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
        if (!birthDate && saved.birthDate) {
          const yyyy = saved.birthDate.getUTCFullYear();
          const mm = String(saved.birthDate.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(saved.birthDate.getUTCDate()).padStart(2, "0");
          birthDate = `${yyyy}-${mm}-${dd}`;
        }
        if (!gender && saved.gender) {
          gender = normalizeGender(saved.gender);
        }
      }
    }

    if (!birthDate || !gender) {
      return NextResponse.json(
        { error: "Respondent profile is incomplete for provider launch." },
        { status: 400 }
      );
    }

    const countryCode = String(project.countryCode || "").trim().toUpperCase();
    if (!countryCode) {
      return NextResponse.json(
        { error: "Project countryCode is missing." },
        { status: 400 }
      );
    }

    const quotaId = String(project.apiSurveySelection.quotaId || "").trim();
    if (!quotaId) {
      return NextResponse.json(
        { error: "Toluna quotaId is missing on ApiSurveySelection." },
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
      panelGuidEnCa: project.client.panelGuidEnCa,
      panelGuidEnIn: project.client.panelGuidEnIn,
      panelGuidPtBr: project.client.panelGuidPtBr,
    } satisfies TolunaClientConfig;

    await ensureTolunaMember({
      client,
      profile: {
        memberCode: externalId,
        birthDate,
        gender,
        countryCode,
      },
    });

    const invite = await generateTolunaInvite({
      client,
      countryCode,
      memberCode: externalId,
      quotaId,
    });

    let redirectRow = await prisma.surveyRedirect.findFirst({
      where: {
        projectId: project.id,
        supplierId: supplierId || null,
        externalId,
        result: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const destination = invite.inviteUrl;

    if (redirectRow) {
      await prisma.surveyRedirect.update({
        where: { id: redirectRow.id },
        data: {
          destination,
        },
      });
    } else {
      redirectRow = await prisma.surveyRedirect.create({
        data: {
          id: id20(),
          projectId: project.id,
          supplierId: supplierId || null,
          externalId,
          destination,
        },
        select: { id: true },
      });
    }

    return NextResponse.redirect(invite.inviteUrl, 302);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown provider-launch error";
    console.error("provider-launch error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}