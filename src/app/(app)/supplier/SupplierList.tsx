// FILE: src/app/(app)/supplier/SupplierList.tsx
"use client";
export const runtime = 'edge';

import React, { useEffect, useMemo, useState } from "react";
import { Edit3 } from "lucide-react";
import { COUNTRIES } from "@/data/countries";
import { useRouter } from "next/navigation";

/* ----------------------------- Types & helpers ----------------------------- */
type Supplier = {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  api: boolean;
};

type ListResp = { items: Supplier[]; total: number };

const Pill = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm ${className}`}
  >
    {children}
  </div>
);

const Dot = ({ className = "" }: { className?: string }) => (
  <span className={`inline-block h-3 w-3 rounded ${className}`} />
);

// country code -> country name
const countryName = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code;

// tiny fetch helper
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* --------------------------------- Page --------------------------------- */
export default function SupplierList() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [rows, setRows] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);   // api=true
  const [inactiveCount, setInactiveCount] = useState(0); // api=false
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // fetch list
  useEffect(() => {
    let cancel = false;
    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const { items, total } = await getJSON<ListResp>(
          `/api/supplier?${params.toString()}`
        );

        if (cancel) return;
        setRows(items);
        setTotal(total);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "Failed to load suppliers");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [q, page]);

  // fetch counts for “Active / InActive”
  useEffect(() => {
    let cancel = false;
    async function run() {
      try {

        const params = new URLSearchParams();
        // Active = api=true
        const a = await getJSON<ListResp>(
          `/api/supplier?${params.toString()}`
        );
        const i = await getJSON<ListResp>("/api/supplier?api=1&pageSize=1");
        if (cancel) return;
        setActiveCount(a.total);
        setInactiveCount(i.total);
      } catch {
        // If this fails, don’t block the page
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, []);

  // pagination calculations (based on total from API)
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);

  const pageNums = useMemo(() => {
    const out: (number | "…")[] = [];
    if (totalPages <= 8) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
      return out;
    }
    const add = (x: number | "…") => out.push(x);
    add(1);
    if (current > 4) add("…");
    for (
      let i = Math.max(2, current - 2);
      i <= Math.min(totalPages - 1, current + 2);
      i++
    )
      add(i);
    if (current < totalPages - 3) add("…");
    add(totalPages);
    return out;
  }, [current, totalPages]);

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Supplier</h1>

        <Pill className="bg-teal-600 text-white">Total-{total}</Pill>

        <Pill className="bg-white text-slate-800 border border-slate-200">
          <Dot className="bg-emerald-500" />
          Active-{activeCount}
        </Pill>

        <Pill className="bg-white text-slate-800 border border-slate-200">
          <Dot className="bg-amber-400" />
          InActive-{inactiveCount}
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
                <th className="px-4 py-3">SupplierCode</th>
                <th className="px-4 py-3">SupplierName</th>
                <th className="px-4 py-3">Country</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="px-4 py-3">
                      {(current - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-slate-300 p-1.5 hover:bg-slate-100"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => router.push(`/supplier/${r.id}/edit`)}
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-900">
                      {r.code}
                    </td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{countryName(r.countryCode)}</td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                    {err ? `Error: ${err}` : "No results."}
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