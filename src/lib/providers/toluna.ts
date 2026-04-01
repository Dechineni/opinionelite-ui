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

export type ProviderSurveyDetail = {
  clientId: string;
  clientName: string;
  countryCode: string;
  surveyCode: string;
  quotaId: string;
  surveyName: string;
  quota: string;
  loi: string;
  ir: string;
  cpi: string;
  liveUrl: string;
  testUrl: string;
  targeting: Array<{ label: string; value: string }>;
};

export type TolunaClientConfig = {
  id: string;
  code: string;
  name: string;
  apiUrl: string | null; // Toluna External Sample base URL
  apiKey: string | null; // Toluna API_AUTH_KEY
  panelGuidEnUs: string | null;
  panelGuidEnGb: string | null;
};

type TolunaQuestionAnswer = {
  PreCodes?: string[];
  AnswerText?: string;
};

type TolunaSubQuota = {
  QuestionID?: number;
  QuestionText?: string;
  QuestionAnswers?: TolunaQuestionAnswer[];
};

type TolunaLayer = {
  LayerName?: string;
  SubQuotas?: TolunaSubQuota[];
};

type TolunaQuota = {
  QuotaID?: number;
  EstimatedCompletesRemaining?: number;
  CompletesRequired?: number;
  Layers?: TolunaLayer[];
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

async function fetchTolunaQuotas(args: {
  client: TolunaClientConfig;
  countryCode: string;
}): Promise<TolunaGetQuotasResponse> {
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

  return json || {};
}

function flattenTolunaTargeting(quotas: TolunaQuota[] | undefined) {
  const out: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  const qs = Array.isArray(quotas) ? quotas : [];

  for (const quota of qs) {
    const layers = Array.isArray(quota.Layers) ? quota.Layers : [];

    for (const layer of layers) {
      const subQuotas = Array.isArray(layer.SubQuotas) ? layer.SubQuotas : [];

      for (const sub of subQuotas) {
        const questionText = String(sub.QuestionText || "").trim();
        const layerName = String(layer.LayerName || "").trim();

        const answers = Array.isArray(sub.QuestionAnswers) ? sub.QuestionAnswers : [];

        const answerTexts = answers
          .map((a: TolunaQuestionAnswer) => String(a.AnswerText || "").trim())
          .filter(Boolean);

        const preCodes = answers
          .flatMap((a: TolunaQuestionAnswer) =>
            Array.isArray(a.PreCodes) ? a.PreCodes : []
          )
          .map((v: string) => String(v).trim())
          .filter(Boolean);

        const label = questionText || layerName;
        const value =
          answerTexts.length > 0
            ? answerTexts.join(", ")
            : preCodes.length > 0
            ? preCodes.join(", ")
            : "";

        // skip noisy empty rows
        if (!label && !value) continue;
        if (!value) continue;

        const key = `${label || "Targeting"}::${value}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          label: label || "Targeting",
          value,
        });
      }
    }
  }

  return out;
}

export async function getTolunaSurveys(args: {
  client: TolunaClientConfig;
  countryCode: string;
}): Promise<ProviderSurveyResult> {
  const { client } = args;
  const countryCode = String(args.countryCode || "").trim().toUpperCase();

  const json = await fetchTolunaQuotas({ client, countryCode });

  const surveys = Array.isArray(json.Surveys) ? json.Surveys : [];
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

export async function getTolunaSurveyDetail(args: {
  client: TolunaClientConfig;
  countryCode: string;
  surveyCode: string;
  quotaId: string;
}): Promise<ProviderSurveyDetail> {
  const { client } = args;
  const countryCode = String(args.countryCode || "").trim().toUpperCase();
  const surveyCode = String(args.surveyCode || "").trim();
  const quotaId = String(args.quotaId || "").trim();

  const [surveyResult, json] = await Promise.all([
    getTolunaSurveys({ client, countryCode }),
    fetchTolunaQuotas({ client, countryCode }),
  ]);

  const surveys = Array.isArray(json.Surveys) ? json.Surveys : [];
  const survey = surveys.find((s: TolunaSurvey) => String(s.SurveyID ?? "") === surveyCode);

  if (!survey) {
    throw new Error("Selected Toluna survey was not found");
  }

  const quotas = Array.isArray(survey.Quotas) ? survey.Quotas : [];
  const quota = quotas.find((q: TolunaQuota) => String(q.QuotaID ?? "") === quotaId);

  if (!quota) {
    throw new Error("Selected Toluna quota was not found");
  }

  const summaryRow =
    surveyResult.items.find(
      (item) => item.surveyCode === surveyCode && item.quotaId === quotaId
    ) || null;

  return {
    clientId: client.id,
    clientName: client.name,
    countryCode,
    surveyCode,
    quotaId,
    surveyName: String(survey.SurveyName ?? "").trim(),
    quota:
      summaryRow?.quota ||
      formatNumber(quota.EstimatedCompletesRemaining ?? quota.CompletesRequired),
    loi: summaryRow?.loi || formatNumber(survey.LOI),
    ir: summaryRow?.ir || formatPercent(survey.IR),
    cpi: summaryRow?.cpi || formatMoney(survey.Price?.Amount),
    liveUrl: "",
    testUrl: "",
    targeting: flattenTolunaTargeting([quota]),
  };
}