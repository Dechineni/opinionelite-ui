// FILE: src/app/(app)/projects/ApiSurveyDetails.tsx
"use client";
export const runtime = "edge";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TargetingItem = {
  label: string;
  value: string;
};

type SurveyDetail = {
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
  targeting: TargetingItem[];
  providerType?: string;
  rawSurvey?: unknown;
};

type DebugQuotaShape = {
  surveyId: string;
  quotaId: string;
  layersCount: number;
  subQuotaCount: number;
  questionIdCount: number;
  answerTextCount: number;
  answerIdCount: number;
  preCodeCount: number;
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="grid grid-cols-12 gap-4 border-b border-slate-200 py-3 text-sm last:border-b-0">
    <div className="col-span-12 md:col-span-3 font-semibold text-slate-700">{label}</div>
    <div className="col-span-12 md:col-span-9 text-slate-800 break-all">{value || "-"}</div>
  </div>
);

function buildQuotaDebug(rawSurvey: unknown, currentQuotaId: string): DebugQuotaShape | null {
  if (!rawSurvey || typeof rawSurvey !== "object") return null;

  const survey: any = rawSurvey;
  const quotas = Array.isArray(survey?.Quotas) ? survey.Quotas : [];
  const quota = quotas.find((q: any) => String(q?.QuotaID ?? "") === String(currentQuotaId));
  if (!quota) return null;

  const layers = Array.isArray(quota?.Layers) ? quota.Layers : [];

  let subQuotaCount = 0;
  let questionIdCount = 0;
  let answerTextCount = 0;
  let answerIdCount = 0;
  let preCodeCount = 0;

  for (const layer of layers) {
    const subQuotas = Array.isArray(layer?.SubQuotas) ? layer.SubQuotas : [];
    subQuotaCount += subQuotas.length;

    for (const sub of subQuotas) {
      if (sub?.QuestionID !== undefined && sub?.QuestionID !== null && String(sub.QuestionID).trim() !== "") {
        questionIdCount += 1;
      }

      const answers = Array.isArray(sub?.QuestionAnswers) ? sub.QuestionAnswers : [];
      for (const ans of answers) {
        if (String(ans?.AnswerText ?? ans?.AnswerValue ?? "").trim()) {
          answerTextCount += 1;
        }
        if (ans?.AnswerID !== undefined && ans?.AnswerID !== null) {
          answerIdCount += 1;
        }
        if (Array.isArray(ans?.AnswerIds)) {
          answerIdCount += ans.AnswerIds.filter((v: any) => v !== undefined && v !== null && String(v).trim() !== "").length;
        }
        if (Array.isArray(ans?.PreCodes)) {
          preCodeCount += ans.PreCodes.filter((v: any) => String(v ?? "").trim() !== "").length;
        }
      }
    }
  }

  return {
    surveyId: String(survey?.SurveyID ?? ""),
    quotaId: String(quota?.QuotaID ?? ""),
    layersCount: layers.length,
    subQuotaCount,
    questionIdCount,
    answerTextCount,
    answerIdCount,
    preCodeCount,
  };
}

export default function ApiSurveyDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("clientId") || "";
  const countryCode = searchParams.get("countryCode") || "";
  const surveyCode = searchParams.get("surveyCode") || "";
  const quotaId = searchParams.get("quotaId") || "";

  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({
          clientId,
          countryCode,
          surveyCode,
          quotaId,
        });

        const res = await fetch(`/api/provider-survey-details?${qs.toString()}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `Failed to load survey details (${res.status})`);
        }

        if (!alive) return;
        setDetail(data);

        setSavingSelection(true);
        const saveRes = await fetch("/api/api-survey-selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: data.clientId,
            providerType: data.providerType || "",
            countryCode: data.countryCode,
            surveyCode: data.surveyCode,
            quotaId: data.quotaId,
            surveyName: data.surveyName,
            quota: data.quota,
            loi: data.loi,
            ir: data.ir,
            cpi: data.cpi,
            liveUrl: data.liveUrl,
            testUrl: data.testUrl,
            targeting: data.targeting,
            rawSurvey: data.rawSurvey ?? null,
          }),
        });

        const saved = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) {
          throw new Error(saved?.error || `Failed to save API survey selection (${saveRes.status})`);
        }

        if (!alive) return;
        setSelectionId(saved?.id || null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load survey details");
      } finally {
        if (alive) {
          setSavingSelection(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [clientId, countryCode, surveyCode, quotaId]);

  const debugQuota = useMemo(
    () => buildQuotaDebug(detail?.rawSurvey, quotaId),
    [detail?.rawSurvey, quotaId]
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        Back
      </button>

      <h1 className="text-xl font-semibold">Survey Details</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading survey details...</div>
        ) : error ? (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : !detail ? (
          <div className="py-10 text-center text-sm text-slate-500">No details found</div>
        ) : (
          <>
            <DetailRow label="Client" value={detail.clientName} />
            <DetailRow label="Country" value={detail.countryCode} />
            <DetailRow label="SurveyCode" value={detail.surveyCode} />
            <DetailRow label="QuotaId" value={detail.quotaId} />
            <DetailRow label="SurveyName" value={detail.surveyName} />
            <DetailRow label="Quota" value={detail.quota} />
            <DetailRow label="LOI" value={detail.loi} />
            <DetailRow label="IR" value={detail.ir} />
            <DetailRow label="CPI" value={detail.cpi} />
            <DetailRow label="LiveURL" value={detail.liveUrl} />
            <DetailRow label="TestURL" value={detail.testUrl} />

            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-700">Targeting</div>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {detail.targeting.length === 0 ? (
                  <div>No targeting available</div>
                ) : (
                  detail.targeting.map((item, idx) => (
                    <div key={`${item.label}-${idx}`}>
                      <span className="font-semibold">{item.label}:</span> {item.value}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              {savingSelection
                ? "Saving API survey selection..."
                : selectionId
                ? `Saved selection: ${selectionId}`
                : ""}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={!selectionId || savingSelection}
                onClick={() => {
                  if (!selectionId) return;
                  router.push(`/projects/new/single?selectionId=${selectionId}`);
                }}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Launch
              </button>
            </div>

            {/* Temporary debug block */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showDebug ? "Hide Debug Targeting" : "Show Debug Targeting"}
              </button>

              {showDebug && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Use this section only for verification. It helps us confirm whether the selected quota
                    actually contains targeting data or whether the mapping still needs adjustment.
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div><span className="font-semibold">SurveyCode:</span> {surveyCode}</div>
                    <div><span className="font-semibold">QuotaId:</span> {quotaId}</div>
                    <div><span className="font-semibold">Mapped targeting rows:</span> {detail.targeting.length}</div>
                    <div><span className="font-semibold">Has rawSurvey:</span> {detail.rawSurvey ? "Yes" : "No"}</div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="mb-2 font-semibold text-slate-700">Quota structure summary</div>
                    {debugQuota ? (
                      <div className="space-y-1 text-slate-800">
                        <div><span className="font-semibold">SurveyID:</span> {debugQuota.surveyId || "-"}</div>
                        <div><span className="font-semibold">QuotaID:</span> {debugQuota.quotaId || "-"}</div>
                        <div><span className="font-semibold">Layers count:</span> {debugQuota.layersCount}</div>
                        <div><span className="font-semibold">SubQuotas count:</span> {debugQuota.subQuotaCount}</div>
                        <div><span className="font-semibold">QuestionID count:</span> {debugQuota.questionIdCount}</div>
                        <div><span className="font-semibold">Answer text/value count:</span> {debugQuota.answerTextCount}</div>
                        <div><span className="font-semibold">Answer ID count:</span> {debugQuota.answerIdCount}</div>
                        <div><span className="font-semibold">PreCodes count:</span> {debugQuota.preCodeCount}</div>
                      </div>
                    ) : (
                      <div className="text-slate-500">Could not locate the selected quota in rawSurvey.</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="mb-2 font-semibold text-slate-700">Raw survey JSON</div>
                    <pre className="max-h-[500px] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap break-words">
{JSON.stringify(detail.rawSurvey ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}