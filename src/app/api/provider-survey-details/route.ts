// FILE: src/app/api/provider-survey-details/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getTolunaSurveyDetail,
  type TolunaClientConfig,
} from "@/lib/providers/toluna";

function normalizeProviderType(v: string | null | undefined) {
  return String(v ?? "").trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const clientId = (searchParams.get("clientId") || "").trim();
    const countryCode = (searchParams.get("countryCode") || "").trim().toUpperCase();
    const surveyCode = (searchParams.get("surveyCode") || "").trim();
    const quotaId = (searchParams.get("quotaId") || "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
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

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        code: true,
        name: true,
        apiUrl: true,
        apiKey: true,
        secretKey: true,
        providerType: true,
        memberApiUrl: true,
        partnerGuid: true,
        panelGuidEnUs: true,
        panelGuidEnGb: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const providerType = normalizeProviderType(client.providerType);

    if (!providerType) {
      return NextResponse.json(
        { error: "Selected client does not have an Integration Provider configured" },
        { status: 400 }
      );
    }

    switch (providerType) {
      case "toluna": {
        const detail = await getTolunaSurveyDetail({
          client: client as TolunaClientConfig,
          countryCode,
          surveyCode,
          quotaId,
        });

        return NextResponse.json({
          ...detail,
          providerType,
          rawSurvey: null,
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Integration Provider '${client.providerType}' is not supported yet`,
          },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to load provider survey details",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}