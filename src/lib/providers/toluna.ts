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
  rawSurvey?: unknown;
};

export type TolunaClientConfig = {
  id: string;
  code: string;
  name: string;
  apiUrl: string | null;
  apiKey: string | null;
  memberApiUrl?: string | null;
  refDataUrl?: string | null;
  partnerAuthKey?: string | null;
  panelGuidEnUs: string | null;
  panelGuidEnGb: string | null;
};

type TolunaQuestionAnswerRef = {
  QuestionID?: number;
  AnswerIDs?: number[];
  AnswerValues?: string[];
  IsRoutable?: boolean;
};

type TolunaSubQuota = {
  SubQuotaID?: number;
  CurrentCompletes?: number;
  MaxTargetCompletes?: number;
  QuestionsAndAnswers?: TolunaQuestionAnswerRef[];
};

type TolunaLayer = {
  LayerID?: number;
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

type RefQuestionAnswerRow = {
  IsRoutable?: boolean;
  InternalName?: string;
  TranslatedQuestion?: {
    QuestionID?: number;
    CultureID?: number;
    DisplayNameTranslation?: string;
  } | null;
  ChildQuestions?: Array<{
    QuestionID?: number;
    CultureID?: number;
    DisplayNameTranslation?: string;
  }> | null;
  TranslatedAnswers?: Array<{
    AnswerID?: number;
    Translation?: string;
    AnswerInternalName?: string;
  }> | null;
};

type RefBundle = {
  questionsById: Map<string, string>;
  answersById: Map<string, string>;
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

function resolveTolunaCultureId(countryCode: string) {
  const cc = String(countryCode || "").trim().toUpperCase();
  if (cc === "US") return 1;
  if (cc === "GB" || cc === "UK") return 5;
  return null;
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

const TOLUNA_AGE_ANSWER_MAP: Record<string, string> = {
  "2006352": "18-24",
  "2006353": "25-29",
  "2006354": "30-34",
  "2006355": "35-39",
  "2006356": "40-44",
  "2006357": "45-49",
  "2006358": "50-54",
  "2006359": "55-59",
  "2006360": "60-64",
  "2006361": "65 and older",
};

function mapTolunaAgeAnswers(answerIds: string[]) {
  return answerIds
    .map((id) => TOLUNA_AGE_ANSWER_MAP[id] || "")
    .filter(Boolean);
}


async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  const rawText = await res.text();
  let json: any = null;

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
    throw new Error(`Toluna request failed (${res.status}): ${detail}`);
  }

  return json;
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

  return (await fetchJson(quotasUrl, {
    method: "GET",
    headers: {
      API_AUTH_KEY: client.apiKey,
      Accept: "application/json",
    },
  })) as TolunaGetQuotasResponse;
}

async function fetchTolunaReferenceBundle(args: {
  client: TolunaClientConfig;
  countryCode: string;
}): Promise<RefBundle | null> {
  const { client } = args;
  const countryCode = String(args.countryCode || "").trim().toUpperCase();

  if (!client.refDataUrl || !client.partnerAuthKey) {
    return null;
  }

  const cultureId = resolveTolunaCultureId(countryCode);
  if (!cultureId) {
    return null;
  }

  const baseUrl = client.refDataUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/IPUtilityService/ReferenceData/QuestionsAndAnswersData`;

  const body = {
    CultureIDs: [cultureId],
    CategoryIDs: [],
    IncludeComputed: true,
    IncludeRoutables: true,
    IncludeDemographics: true,
  };

  const json = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      PARTNER_AUTH_KEY: client.partnerAuthKey,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const rows: RefQuestionAnswerRow[] = Array.isArray(json) ? json : [];

  const questionsById = new Map<string, string>();
  const answersById = new Map<string, string>();

  for (const row of rows) {
    const qId = String(row.TranslatedQuestion?.QuestionID ?? "").trim();
    const qText = String(row.TranslatedQuestion?.DisplayNameTranslation ?? "").trim();

    if (qId && qText) {
      questionsById.set(qId, qText);
    }

    const answers = Array.isArray(row.TranslatedAnswers) ? row.TranslatedAnswers : [];
    for (const ans of answers) {
      const aId = String(ans.AnswerID ?? "").trim();
      const aText = String(ans.Translation ?? ans.AnswerInternalName ?? "").trim();
      if (aId && aText) {
        answersById.set(aId, aText);
      }
    }
  }

  return { questionsById, answersById };
}

function flattenTolunaTargeting(
  quotas: TolunaQuota[] | undefined,
  refBundle?: RefBundle | null
) {
  const out: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  const qs = Array.isArray(quotas) ? quotas : [];

  for (const quota of qs) {
    const layers = Array.isArray(quota.Layers) ? quota.Layers : [];

    for (const layer of layers) {
      const subQuotas = Array.isArray(layer.SubQuotas) ? layer.SubQuotas : [];

      for (const sub of subQuotas) {
        const qaRows = Array.isArray(sub.QuestionsAndAnswers)
          ? sub.QuestionsAndAnswers
          : [];

        for (const qa of qaRows) {
          const questionId = String(qa.QuestionID ?? "").trim();
          const label =
            (questionId ? refBundle?.questionsById.get(questionId) || "" : "") ||
            String(layer.LayerName || "").trim() ||
            "Targeting";

          const answerValues = Array.isArray(qa.AnswerValues)
            ? qa.AnswerValues.map((v) => String(v).trim()).filter(Boolean)
            : [];

          const answerIds = Array.isArray(qa.AnswerIDs)
            ? qa.AnswerIDs.map((v) => String(v).trim()).filter(Boolean)
            : [];

          const mappedAnswers = answerIds
            .map((id) => refBundle?.answersById.get(id) || "")
            .filter(Boolean);

          const manualAgeAnswers =
            questionId === "1001538" ? mapTolunaAgeAnswers(answerIds) : [];

          const finalLabel =
            questionId === "1001538"
              ? "Age"
              : (questionId ? refBundle?.questionsById.get(questionId) || "" : "") ||
              String(layer.LayerName || "").trim() ||
              "Targeting";

          const value =
            answerValues.length > 0
              ? answerValues.join(", ")
              : manualAgeAnswers.length > 0
              ? manualAgeAnswers.join(", ")
              : mappedAnswers.length > 0
              ? mappedAnswers.join(", ")
              : answerIds.length > 0
              ? answerIds.join(", ")
              : "";

          if (!value) continue;

          const key = `${label}::${value}`;
          if (seen.has(key)) continue;
          seen.add(key);

          out.push({ label: finalLabel, value });
        }
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

  const [surveyResult, json, refBundle] = await Promise.all([
    getTolunaSurveys({ client, countryCode }),
    fetchTolunaQuotas({ client, countryCode }),
    fetchTolunaReferenceBundle({ client, countryCode }).catch((err) => {
      console.error("Toluna reference bundle error:", err);
      return null;
    }),
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
    targeting: flattenTolunaTargeting([quota], refBundle),
    rawSurvey: survey,
  };
}