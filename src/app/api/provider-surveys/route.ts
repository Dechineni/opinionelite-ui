// FILE: src/app/api/provider-surveys/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type SurveyRow = {
  surveyCode: string;
  quotaId: string;
  surveyName: string;
  quota: string;
  loi: string;
  ir: string;
  cpi: string;
};

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);

    const clientId = (searchParams.get("clientId") || "").trim();
    const countryCode = (searchParams.get("countryCode") || "").trim().toUpperCase();

    if (!clientId) {
      return NextResponse.json(
        { error: "Missing clientId" },
        { status: 400 }
      );
    }

    if (!countryCode) {
      return NextResponse.json(
        { error: "Missing countryCode" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        code: true,
        name: true,
        countryCode: true,
        apiUrl: true,
        apiKey: true,
        secretKey: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.apiUrl) {
      return NextResponse.json(
        { error: "Selected client does not have API configuration" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // MOCK DATA FOR NOW
    // Later this section will call the actual provider API
    // based on client.apiUrl / apiKey / secretKey / countryCode
    // ---------------------------------------------------------
    const items: SurveyRow[] = [
      {
        surveyCode: "SURV-1001",
        quotaId: "Q-001",
        surveyName: `${client.name} Consumer Habits - ${countryCode}`,
        quota: "100",
        loi: "12",
        ir: "35%",
        cpi: "2.50",
      },
      {
        surveyCode: "SURV-1002",
        quotaId: "Q-002",
        surveyName: `${client.name} Brand Awareness - ${countryCode}`,
        quota: "250",
        loi: "15",
        ir: "28%",
        cpi: "3.20",
      },
      {
        surveyCode: "SURV-1003",
        quotaId: "Q-003",
        surveyName: `${client.name} Shopping Preferences - ${countryCode}`,
        quota: "80",
        loi: "10",
        ir: "40%",
        cpi: "1.90",
      },
    ];

    return NextResponse.json({
      client: {
        id: client.id,
        code: client.code,
        name: client.name,
        apiUrl: client.apiUrl,
      },
      countryCode,
      items,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to load provider surveys",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}