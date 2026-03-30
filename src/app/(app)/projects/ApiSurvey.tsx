"use client";
export const runtime = "edge";

import React, { useEffect, useMemo, useState } from "react";
import { COUNTRIES } from "@/data/countries";

type ClientLite = {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  apiUrl: string | null;
  apiKey: string | null;
  secretKey: string | null;
};

type SurveyRow = {
  surveyCode: string;
  quotaId: string;
  surveyName: string;
  quota: string;
  loi: string;
  ir: string;
  cpi: string;
};

const Label = ({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="mb-1 block text-xs font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-500">*</span>}
  </label>
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={[
      "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

export default function ApiSurvey() {
  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  // Placeholder rows for now; later this will come from provider API
  const [rows, setRows] = useState<SurveyRow[]>([]);

  const COUNTRY_OPTS = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingClients(true);
      setError(null);
      try {
        const res = await fetch("/api/client?mode=lite&apiOnly=1&page=1&pageSize=200");
        if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);

        const data = await res.json();
        if (!alive) return;

        setClients(Array.isArray(data?.items) ? data.items : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load API-enabled clients");
      } finally {
        if (alive) setLoadingClients(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const onView = async () => {
    setError(null);

    if (!selectedClientId) {
      setError("Please select a client.");
      return;
    }

    if (!selectedCountry) {
      setError("Please select a country.");
      return;
    }

    setIsViewing(true);
    try {
      // Placeholder only for now.
      // In next step this will call a backend route that talks to provider API.
      setRows([]);
    } catch (e: any) {
      setError(e?.message || "Failed to load surveys");
    } finally {
      setIsViewing(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">API Survey</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Client</Label>
            <Select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={loadingClients}
            >
              <option value="">
                {loadingClients ? "Loading clients..." : "-- Select Client --"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Country</Label>
            <Select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <option value="">-- Select Country --</option>
              {COUNTRY_OPTS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4 flex items-end">
            <button
              type="button"
              onClick={onView}
              disabled={isViewing || loadingClients}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isViewing ? "Loading..." : "View"}
            </button>
          </div>
        </div>

        {selectedClient && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div>
              <span className="font-medium">Selected Client:</span> {selectedClient.name}
            </div>
            <div className="mt-1">
              <span className="font-medium">API URL:</span>{" "}
              {selectedClient.apiUrl || "-"}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border border-slate-200 text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-left">SurveyCode</th>
                <th className="border border-slate-200 px-3 py-2 text-left">QuotaId</th>
                <th className="border border-slate-200 px-3 py-2 text-left">SurveyName</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Quota</th>
                <th className="border border-slate-200 px-3 py-2 text-left">LOI</th>
                <th className="border border-slate-200 px-3 py-2 text-left">IR</th>
                <th className="border border-slate-200 px-3 py-2 text-left">CPI</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="border border-slate-200 px-3 py-8 text-center text-slate-500"
                  >
                    No Records found
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={`${row.surveyCode}-${row.quotaId}-${idx}`}>
                    <td className="border border-slate-200 px-3 py-2">{row.surveyCode}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.quotaId}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.surveyName}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.quota}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.loi}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.ir}</td>
                    <td className="border border-slate-200 px-3 py-2">{row.cpi}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}