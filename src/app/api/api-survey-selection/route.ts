// FILE: src/app/api/api-survey-selection/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const b = await req.json();

    const clientId = String(b.clientId || "").trim();
    const providerType = String(b.providerType || "").trim();
    const countryCode = String(b.countryCode || "").trim().toUpperCase();
    const surveyCode = String(b.surveyCode || "").trim();
    const quotaId = String(b.quotaId || "").trim();
    const surveyName = String(b.surveyName || "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }
    if (!providerType) {
      return NextResponse.json({ error: "Missing providerType" }, { status: 400 });
    }
    if (!countryCode) {
      return NextResponse.json({ error: "Missing countryCode" }, { status: 400 });
    }
    if (!surveyCode) {
      return NextResponse.json({ error: "Missing surveyCode" }, { status: 400 });
    }
    if (!quotaId) {
      return NextResponse.json({ error: "Missing quotaId" }, { status: 400 });
    }
    if (!surveyName) {
      return NextResponse.json({ error: "Missing surveyName" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const targetingJson =
      b.targeting == null ? null : JSON.stringify(Array.isArray(b.targeting) ? b.targeting : []);
    const rawSurveyJson =
      b.rawSurvey == null ? null : JSON.stringify(b.rawSurvey);

    const saved = await prisma.apiSurveySelection.upsert({
      where: {
        clientId_countryCode_surveyCode_quotaId: {
          clientId,
          countryCode,
          surveyCode,
          quotaId,
        },
      },
      create: {
        clientId,
        providerType,
        countryCode,
        surveyCode,
        quotaId,
        surveyName,
        quota: b.quota ?? null,
        loi: b.loi ?? null,
        ir: b.ir ?? null,
        cpi: b.cpi ?? null,
        liveUrl: b.liveUrl ?? null,
        testUrl: b.testUrl ?? null,
        targetingJson,
        rawSurveyJson,
      },
      update: {
        providerType,
        surveyName,
        quota: b.quota ?? null,
        loi: b.loi ?? null,
        ir: b.ir ?? null,
        cpi: b.cpi ?? null,
        liveUrl: b.liveUrl ?? null,
        testUrl: b.testUrl ?? null,
        targetingJson,
        rawSurveyJson,
      },
      select: {
        id: true,
        clientId: true,
        providerType: true,
        countryCode: true,
        surveyCode: true,
        quotaId: true,
        surveyName: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to save API survey selection",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}