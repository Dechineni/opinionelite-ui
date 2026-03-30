"use client";
export const runtime = "edge";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="grid grid-cols-12 gap-4 border-b border-slate-200 py-3 text-sm last:border-b-0">
    <div className="col-span-12 md:col-span-3 font-semibold text-slate-700">{label}</div>
    <div className="col-span-12 md:col-span-9 text-slate-800">{value || "-"}</div>
  </div>
);

export default function ApiSurveyDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const surveyCode = searchParams.get("surveyCode") || "";
  const quotaId = searchParams.get("quotaId") || "";
  const surveyName = searchParams.get("surveyName") || "";
  const quota = searchParams.get("quota") || "";
  const loi = searchParams.get("loi") || "";
  const ir = searchParams.get("ir") || "";
  const cpi = searchParams.get("cpi") || "";
  const clientName = searchParams.get("clientName") || "";
  const countryCode = searchParams.get("countryCode") || "";

  // Placeholder until real provider details API is added
  const liveUrl = "https://insights.opinionelite.com/TestSurvey/Index?rid=[identifier]";
  const testUrl = "https://insights.opinionelite.com/TestSurvey/Index?rid=[identifier]";

  const targetingRows = [
    "Age: 45-64",
    "Gender: Female",
    "State: Alabama, Arkansas, Delaware, Florida, Georgia",
  ];

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
        <DetailRow label="Client" value={clientName} />
        <DetailRow label="Country" value={countryCode} />
        <DetailRow label="SurveyCode" value={surveyCode} />
        <DetailRow label="QuotaId" value={quotaId} />
        <DetailRow label="SurveyName" value={surveyName} />
        <DetailRow label="Quota" value={quota} />
        <DetailRow label="LOI" value={loi} />
        <DetailRow label="IR" value={ir} />
        <DetailRow label="CPI" value={cpi} />
        <DetailRow label="LiveURL" value={liveUrl} />
        <DetailRow label="TestURL" value={testUrl} />

        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold text-slate-700">Targeting</div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            {targetingRows.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
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
      </div>
    </div>
  );
}