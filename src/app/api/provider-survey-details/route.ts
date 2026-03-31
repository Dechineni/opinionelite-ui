// FILE: src/app/api/provider-survey-details/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

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
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.apiUrl) {
      return NextResponse.json(
        { error: "Selected client does not have API configuration" },
        { status: 400 }
      );
    }

    // MOCK DETAILS FOR NOW
    // Later this will call the provider's survey details endpoint.
    const detail = {
      clientId: client.id,
      clientName: client.name,
      countryCode,
      surveyCode,
      quotaId,
      surveyName: `${client.name} Ad-Hoc Survey`,
      quota: "3",
      loi: "15",
      ir: "54",
      cpi: "16",
      liveUrl: "https://insights.opinionelite.com/TestSurvey/Index?rid=[identifier]",
      testUrl: "https://insights.opinionelite.com/TestSurvey/Index?rid=[identifier]",
      targeting: [
        {
          label: "Age",
          value: "45-64",
        },
        {
          label: "Gender",
          value: "Female",
        },
        {
          label: "State",
          value:
            "Alabama, Arkansas, Delaware, Florida, Georgia, Kentucky, Louisiana, Maryland, Mississippi, North Carolina, Oklahoma, South Carolina, Tennessee, Texas, Virginia, West Virginia",
        },
      ],
    };

    return NextResponse.json(detail);
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