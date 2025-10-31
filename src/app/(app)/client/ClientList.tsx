export const runtime = 'edge';

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3 } from "lucide-react";
import { COUNTRIES } from "@/data/countries"; // or ../../data/countries
import { useRouter } from "next/navigation";

type ApiClient = {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  contactPerson: string;
  contactNumber: string | null;
  email: string | null;
  website: string | null;
  createdAt: string;
};

type ApiListResponse = {
  items: ApiClient[];
  total: number;
  active?: number;
  inactive?: number;
};

const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ${className}`}>
    {children}
  </div>
);

const Dot = ({ className = "" }: { className?: string }) => <span className={`inline-block h-3 w-3 rounded ${className}`} />;

export default function ClientList() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [rows, setRows] = useState<ApiClient[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // country code -> name map
  const countryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of COUNTRIES) m.set(c.code, c.name);
    return m;
  }, []);

  // debounce search slightly
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/client?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data: ApiListResponse = await res.json();
        setRows(data.items);
        setTotal(data.total);
        setActiveCount(data.active);
      } catch {
        // ignore aborted/failed
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const inactiveCount = activeCount !== undefined ? total - activeCount : undefined;

  const pageNums = useMemo(() => {
    const out: (number | "…")[] = [];
    if (totalPages <= 8) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
      return out;
    }
    const add = (x: number | "…") => out.push(x);
    add(1);
    if (current > 4) add("…");
    for (let i = Math.max(2, current - 2); i <= Math.min(totalPages - 1, current + 2); i++) add(i);
    if (current < totalPages - 3) add("…");
    add(totalPages);
    return out;
  }, [current, totalPages]);

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Client</h1>

        <Pill className="bg-teal-600 text-white">Total-{total}</Pill>

        <Pill className="bg-white text-slate-800 border border-slate-200">
          <Dot className="bg-emerald-500" />
          Active-{activeCount ?? "—"}
        </Pill>

        <Pill className="bg-white text-slate-800 border border-slate-200">
          <Dot className="bg-amber-400" />
          InActive-{inactiveCount ?? "—"}
        </Pill>

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search..."
          className="ml-auto w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white p-0 shadow-sm">
        <div className="max-h-[65vh] overflow-auto rounded-xl">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3">S.No.</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">ClientCode</th>
                <th className="px-4 py-3">ClientName</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-right">Click</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="px-4 py-3">{(current - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-slate-300 p-1.5 hover:bg-slate-100"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => router.push(`/client/editclient/${r.id}`)}
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-900">{r.code}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{countryMap.get(r.countryCode) ?? r.countryCode}</td>
                    <td className="px-4 py-3 text-right tabular-nums">—</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-3 py-3">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage(1)}
            disabled={current === 1}
          >
            «
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage(Math.max(1, current - 1))}
            disabled={current === 1}
          >
            ‹
          </button>

          {pageNums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-2 text-slate-500">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  n === current
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            )
          )}

          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage(Math.min(totalPages, current + 1))}
            disabled={current === totalPages}
          >
            ›
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage(totalPages)}
            disabled={current === totalPages}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}