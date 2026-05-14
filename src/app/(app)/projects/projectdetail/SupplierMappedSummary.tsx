// FILE: src/app/(app)/projects/projectdetail/SupplierMappedSummary.tsx
"use client";

export const runtime = "edge";

import React, { useEffect, useMemo, useState } from "react";

type SupplierRow = {
  supplierCode: string;
  supplierName: string;
  total: number;
  complete: number;
  terminate: number;
  overQuota: number;
  dropOut: number;
  qualityTerm: number;

  sentryPass: number;
  sentryFail: number;
  verisoulPass: number;
  verisoulFail: number;
};

type SupplierTotals = {
  total: number;
  complete: number;
  terminate: number;
  overQuota: number;
  dropOut: number;
  qualityTerm: number;

  sentryPass: number;
  sentryFail: number;
  verisoulPass: number;
  verisoulFail: number;
};

const emptyTotals: SupplierTotals = {
  total: 0,
  complete: 0,
  terminate: 0,
  overQuota: 0,
  dropOut: 0,
  qualityTerm: 0,

  sentryPass: 0,
  sentryFail: 0,
  verisoulPass: 0,
  verisoulFail: 0,
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function SupplierMappedSummary({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    fetch(`/api/projects/${encodeURIComponent(projectId)}/supplier-maps`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        // Accept either { items: [...] } or just [...]
        const items: any[] = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];

        setRows(
          items.map((r: any) => {
            // API shape has supplier nested: { supplier: { id, code, name } }
            const supplierCode = String(
              r?.supplier?.code ?? r?.supplierCode ?? r?.code ?? ""
            );

            const supplierName = String(
              r?.supplier?.name ?? r?.supplierName ?? r?.name ?? ""
            );

            return {
              supplierCode,
              supplierName,

              total: toNumber(r?.total),
              complete: toNumber(r?.complete),
              terminate: toNumber(r?.terminate),
              overQuota: toNumber(r?.overQuota),
              dropOut: toNumber(r?.dropOut ?? r?.dropout),
              qualityTerm: toNumber(r?.qualityTerm),

              sentryPass: toNumber(r?.sentryPass),
              sentryFail: toNumber(r?.sentryFail),
              verisoulPass: toNumber(r?.verisoulPass),
              verisoulFail: toNumber(r?.verisoulFail),
            };
          })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(
    () =>
      rows.reduce<SupplierTotals>((acc, r) => {
        acc.total += r.total;
        acc.complete += r.complete;
        acc.terminate += r.terminate;
        acc.overQuota += r.overQuota;
        acc.dropOut += r.dropOut;
        acc.qualityTerm += r.qualityTerm;

        acc.sentryPass += r.sentryPass;
        acc.sentryFail += r.sentryFail;
        acc.verisoulPass += r.verisoulPass;
        acc.verisoulFail += r.verisoulFail;

        return acc;
      }, { ...emptyTotals }),
    [rows]
  );

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md bg-indigo-50 px-4 py-2 text-left"
      >
        <span className="font-semibold text-slate-900">
          {open ? "Supplier Mapped ▾" : "Supplier Mapped ▸"}
        </span>
      </button>

      {open && (
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="w-16 px-4 py-2">S.No.</th>
                <th className="px-4 py-2">SupplierCode</th>
                <th className="px-4 py-2">SupplierName</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Complete</th>
                <th className="px-4 py-2 text-right">Terminate</th>
                <th className="px-4 py-2 text-right">OverQuota</th>
                <th className="px-4 py-2 text-right">DropOut</th>
                <th className="px-4 py-2 text-right">QualityTerm</th>

                <th className="px-4 py-2 text-right">Sentry Pass</th>
                <th className="px-4 py-2 text-right">Sentry Fail</th>
                <th className="px-4 py-2 text-right">Verisoul Pass</th>
                <th className="px-4 py-2 text-right">Verisoul Fail</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={13}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r, i) => (
                  <tr
                    key={`${r.supplierCode || "supplier"}-${i}`}
                    className={i % 2 ? "bg-slate-50" : "bg-white"}
                  >
                    <td className="px-4 py-2">{i + 1}</td>
                    <td className="px-4 py-2">{r.supplierCode}</td>
                    <td className="px-4 py-2">{r.supplierName}</td>
                    <td className="px-4 py-2 text-right">{r.total}</td>
                    <td className="px-4 py-2 text-right">{r.complete}</td>
                    <td className="px-4 py-2 text-right">{r.terminate}</td>
                    <td className="px-4 py-2 text-right">{r.overQuota}</td>
                    <td className="px-4 py-2 text-right">{r.dropOut}</td>
                    <td className="px-4 py-2 text-right">{r.qualityTerm}</td>

                    <td className="px-4 py-2 text-right">{r.sentryPass}</td>
                    <td className="px-4 py-2 text-right">{r.sentryFail}</td>
                    <td className="px-4 py-2 text-right">{r.verisoulPass}</td>
                    <td className="px-4 py-2 text-right">{r.verisoulFail}</td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={13}>
                    No suppliers mapped yet.
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 font-semibold text-white">
                <td className="px-4 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{totals.total}</td>
                <td className="px-4 py-2 text-right">{totals.complete}</td>
                <td className="px-4 py-2 text-right">{totals.terminate}</td>
                <td className="px-4 py-2 text-right">{totals.overQuota}</td>
                <td className="px-4 py-2 text-right">{totals.dropOut}</td>
                <td className="px-4 py-2 text-right">{totals.qualityTerm}</td>

                <td className="px-4 py-2 text-right">{totals.sentryPass}</td>
                <td className="px-4 py-2 text-right">{totals.sentryFail}</td>
                <td className="px-4 py-2 text-right">{totals.verisoulPass}</td>
                <td className="px-4 py-2 text-right">{totals.verisoulFail}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}