// FILE: src/app/api/provider-surveys/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getTolunaSurveys,
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

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    if (!countryCode) {
      return NextResponse.json({ error: "Missing countryCode" }, { status: 400 });
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
        const result = await getTolunaSurveys({
          client: client as TolunaClientConfig,
          countryCode,
        });

        return NextResponse.json({
          client: {
            id: client.id,
            code: client.code,
            name: client.name,
            providerType: client.providerType,
            apiUrl: client.apiUrl,
          },
          countryCode,
          items: result.items,
          source: result.source,
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
        error: "Failed to load provider surveys",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}