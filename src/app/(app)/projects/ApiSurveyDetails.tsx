"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
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

export default function ApiSurveyDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("clientId") || "";
  const countryCode = searchParams.get("countryCode") || "";
  const surveyCode = searchParams.get("surveyCode") || "";
  const quotaId = searchParams.get("quotaId") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SurveyDetail | null>(null);

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
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load survey details");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clientId, countryCode, surveyCode, quotaId]);

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

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Launch
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}