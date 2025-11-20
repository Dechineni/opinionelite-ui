// src/app/(app)/projects/ProjectList.tsx
"use client";
export const runtime = 'edge';

import React, { useEffect, useState } from "react";
// Mirror of your schema enum (keep in sync with Prisma schema)
export type ProjectStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "CLOSED"
  | "INVOICED"
  | "BID";

type ApiProject = {
  id: string;
  code: string;
  name: string;
  managerEmail: string;
  category: string;
  status: ProjectStatus;       // still used for filters/counters
  countryCode: string;
  languageCode: string;
  currency: string;
  loi: number;
  ir: number;
  sampleSize: number;          // kept in type (not shown in UI)
  projectCpi: string;
  supplierCpi: string | null;
  startDate: string;
  endDate: string;

  // NEW (optional so existing API doesn’t break):
  clientName?: string | null;
  c?: number; // completes
  t?: number; // terminates
  q?: number; // over-quotas (we’ll define precisely later)
  d?: number; // dropouts
};

type ApiResp = {
  items: ApiProject[];
  total: number;
  statusCounts: Record<ProjectStatus, number>;
};

export default function ProjectList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [rows, setRows] = useState<ApiProject[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ProjectStatus, number>>({
    ACTIVE: 0,
    INACTIVE: 0,
    CLOSED: 0,
    INVOICED: 0,
    BID: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const url =
      `/api/projects?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}` +
      (status === "ALL" ? "" : `&status=${status}`);

    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: ApiResp) => {
        setRows(d.items || []);
        setTotal(d.total || 0);
        setCounts(d.statusCounts || counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, status]);

  const pill = (label: string, value: number | undefined, active = false) => (
    <button
      onClick={() => {
        setStatus(label as ProjectStatus | "ALL");
        setPage(1);
      }}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-emerald-600 text-white"
          : "bg-white text-slate-800 border border-slate-200"
      }`}
    >
      {label}
      {value !== undefined ? `-${value}` : ""}
    </button>
  );

  const COLS = 12; // total columns rendered

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Projects</h1>
        {pill("ALL", undefined, status === "ALL")}
        {pill("ACTIVE", counts.ACTIVE, status === "ACTIVE")}
        {pill("INACTIVE", counts.INACTIVE, status === "INACTIVE")}
        {pill("CLOSED", counts.CLOSED, status === "CLOSED")}
        {pill("INVOICED", counts.INVOICED, status === "INVOICED")}
        {pill("BID", counts.BID, status === "BID")}

        <input
          className="ml-auto w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3">S.No.</th>
                <th className="px-4 py-3">ProjectCode</th>
                <th className="px-4 py-3">ProjectName</th>
                <th className="px-4 py-3">ClientName</th>      {/* NEW */}
                <th className="px-4 py-3">ProjectManager</th>
                <th className="px-4 py-3 text-right">LOI</th>
                <th className="px-4 py-3 text-right">IR%</th>
                <th className="px-4 py-3 text-right">C</th>     {/* NEW */}
                <th className="px-4 py-3 text-right">T</th>     {/* NEW */}
                <th className="px-4 py-3 text-right">Q</th>     {/* NEW */}
                <th className="px-4 py-3 text-right">D</th>     {/* NEW */}
                <th className="px-4 py-3 text-right">CPI</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLS} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="px-4 py-3">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 font-semibold">
                      <a
                        href={`/projects/projectdetail?id=${encodeURIComponent(r.id)}`}
                        className="text-emerald-700 hover:underline"
                        title={`Open ${r.code}`}
                      >
                        {r.code}
                      </a>
                    </td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.clientName ?? "—"}</td> {/* NEW */}
                    <td className="px-4 py-3">{r.managerEmail}</td>
                    {/* Status removed */}
                    <td className="px-4 py-3 text-right">{r.loi}</td>
                    <td className="px-4 py-3 text-right">{r.ir}</td>
                    {/* Sample removed */}
                    <td className="px-4 py-3 text-right">{r.c ?? 0}</td>  {/* NEW */}
                    <td className="px-4 py-3 text-right">{r.t ?? 0}</td>  {/* NEW */}
                    <td className="px-4 py-3 text-right">{r.q ?? 0}</td>  {/* NEW */}
                    <td className="px-4 py-3 text-right">{r.d ?? 0}</td>  {/* NEW */}
                    <td className="px-4 py-3 text-right">{r.projectCpi}</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLS} className="px-4 py-10 text-center text-slate-500">
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-3 py-3">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            «
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            ‹
          </button>
          <span className="px-2 text-sm">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() => setPage(Math.min(Math.max(1, Math.ceil(total / pageSize)), page + 1))}
            disabled={page === Math.max(1, Math.ceil(total / pageSize))}
          >
            ›
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() => setPage(Math.max(1, Math.ceil(total / pageSize)))}
            disabled={page === Math.max(1, Math.ceil(total / pageSize))}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}