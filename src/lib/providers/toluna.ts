// FILE: src/lib/providers/toluna.ts
export type ProviderSurveyRow = {
  surveyCode: string;
  quotaId: string;
  surveyName: string;
  quota: string;
  loi: string;
  ir: string;
  cpi: string;
};

export type ProviderSurveyResult = {
  source: "toluna";
  countryCode: string;
  items: ProviderSurveyRow[];
};

export type TolunaClientConfig = {
  id: string;
  code: string;
  name: string;
  apiUrl: string | null;       // Toluna External Sample base URL
  apiKey: string | null;       // Toluna API_AUTH_KEY
  panelGuidEnUs: string | null;
  panelGuidEnGb: string | null;
};

type TolunaQuota = {
  QuotaID?: number;
  EstimatedCompletesRemaining?: number;
  CompletesRequired?: number;
};

type TolunaPrice = {
  Amount?: number;
};

type TolunaSurvey = {
  SurveyID?: number;
  SurveyName?: string;
  WaveID?: number;
  LOI?: number;
  IR?: number;
  Price?: TolunaPrice;
  Quotas?: TolunaQuota[];
};

type TolunaGetQuotasResponse = {
  Surveys?: TolunaSurvey[];
  Result?: string;
  ResultCode?: number;
};

function resolveTolunaPanelGuid(
  countryCode: string,
  client: Pick<TolunaClientConfig, "panelGuidEnUs" | "panelGuidEnGb">
) {
  const cc = String(countryCode || "").trim().toUpperCase();

  if (cc === "US") return client.panelGuidEnUs || "";
  if (cc === "GB" || cc === "UK") return client.panelGuidEnGb || "";

  return "";
}

function formatNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function formatPercent(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : "";
}

function formatMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

export async function getTolunaSurveys(args: {
  client: TolunaClientConfig;
  countryCode: string;
}): Promise<ProviderSurveyResult> {
  const { client } = args;
  const countryCode = String(args.countryCode || "").trim().toUpperCase();

  if (!client.apiUrl) {
    throw new Error("Toluna External Sample API URL is missing on the selected client");
  }

  if (!client.apiKey) {
    throw new Error("Toluna API key is missing on the selected client");
  }

  const panelGuid = resolveTolunaPanelGuid(countryCode, client);

  if (!panelGuid) {
    throw new Error(
      countryCode === "US"
        ? "Toluna Panel GUID (EN-US) is missing for this client"
        : countryCode === "GB" || countryCode === "UK"
        ? "Toluna Panel GUID (EN-GB) is missing for this client"
        : `Toluna panel mapping is not configured for country ${countryCode}`
    );
  }

  const baseUrl = client.apiUrl.replace(/\/+$/, "");
  const quotasUrl = `${baseUrl}/IPExternalSamplingService/ExternalSample/${encodeURIComponent(
    panelGuid
  )}/Quotas?includeRoutables=true`;

  const res = await fetch(quotasUrl, {
    method: "GET",
    headers: {
      API_AUTH_KEY: client.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const rawText = await res.text();
  let json: TolunaGetQuotasResponse | null = null;

  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`Toluna response was not valid JSON: ${rawText?.slice(0, 300) || ""}`);
  }

  if (!res.ok) {
    const detail =
      typeof json === "object" && json
        ? JSON.stringify(json)
        : rawText || `HTTP ${res.status}`;
    throw new Error(`Toluna Get Quotas failed (${res.status}): ${detail}`);
  }

  const surveys = Array.isArray(json?.Surveys) ? json!.Surveys! : [];
  const items: ProviderSurveyRow[] = [];

  for (const survey of surveys) {
    const surveyCode = formatNumber(survey.SurveyID);
    const surveyName = String(survey.SurveyName ?? "").trim();
    const loi = formatNumber(survey.LOI);
    const ir = formatPercent(survey.IR);
    const cpi = formatMoney(survey.Price?.Amount);

    const quotas = Array.isArray(survey.Quotas) ? survey.Quotas : [];

    if (quotas.length === 0) {
      items.push({
        surveyCode,
        quotaId: "",
        surveyName,
        quota: "",
        loi,
        ir,
        cpi,
      });
      continue;
    }

    for (const quota of quotas) {
      items.push({
        surveyCode,
        quotaId: formatNumber(quota.QuotaID),
        surveyName,
        quota: formatNumber(
          quota.EstimatedCompletesRemaining ?? quota.CompletesRequired
        ),
        loi,
        ir,
        cpi,
      });
    }
  }

  return {
    source: "toluna",
    countryCode,
    items,
  };
}