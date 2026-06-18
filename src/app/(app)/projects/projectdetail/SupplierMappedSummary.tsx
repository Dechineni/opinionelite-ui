// FILE:src/app/(app)/projects/projectdetail/SupplierMappedSummary.tsx

"use client";

export const runtime = "edge";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

type SupplierRow = {
  supplierCode: string;
  supplierName: string;

  entrants: number;
  inProgress: number;

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
  entrants: number;
  inProgress: number;

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
  entrants: 0,
  inProgress: 0,

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
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
}

export default function SupplierMappedSummary({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] =
    useState(false);

  const [rows, setRows] =
    useState<SupplierRow[]>([]);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    fetch(
      `/api/projects/${encodeURIComponent(
        projectId
      )}/supplier-maps`,
      {
        cache: "no-store",
      }
    )
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }

        /*
         * Accept either:
         * { items: [...] }
         * or a direct array response.
         */
        const items: any[] =
          Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        setRows(
          items.map((item: any) => {
            const supplierCode =
              String(
                item?.supplier?.code ??
                  item?.supplierCode ??
                  item?.code ??
                  ""
              );

            const supplierName =
              String(
                item?.supplier?.name ??
                  item?.supplierName ??
                  item?.name ??
                  ""
              );

            return {
              supplierCode,
              supplierName,

              entrants: toNumber(
                item?.entrants
              ),

              inProgress: toNumber(
                item?.inProgress
              ),

              total: toNumber(
                item?.total
              ),

              complete: toNumber(
                item?.complete
              ),

              terminate: toNumber(
                item?.terminate
              ),

              overQuota: toNumber(
                item?.overQuota
              ),

              dropOut: toNumber(
                item?.dropOut ??
                  item?.dropout
              ),

              qualityTerm: toNumber(
                item?.qualityTerm
              ),

              sentryPass: toNumber(
                item?.sentryPass
              ),

              sentryFail: toNumber(
                item?.sentryFail
              ),

              verisoulPass: toNumber(
                item?.verisoulPass
              ),

              verisoulFail: toNumber(
                item?.verisoulFail
              ),
            };
          })
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load supplier mapped summary:",
          error
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(
    () =>
      rows.reduce<SupplierTotals>(
        (acc, row) => {
          acc.entrants +=
            row.entrants;

          acc.inProgress +=
            row.inProgress;

          acc.total += row.total;
          acc.complete +=
            row.complete;

          acc.terminate +=
            row.terminate;

          acc.overQuota +=
            row.overQuota;

          acc.dropOut +=
            row.dropOut;

          acc.qualityTerm +=
            row.qualityTerm;

          acc.sentryPass +=
            row.sentryPass;

          acc.sentryFail +=
            row.sentryFail;

          acc.verisoulPass +=
            row.verisoulPass;

          acc.verisoulFail +=
            row.verisoulFail;

          return acc;
        },
        {
          ...emptyTotals,
        }
      ),
    [rows]
  );

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        className="flex w-full items-center justify-between rounded-md bg-indigo-50 px-4 py-2 text-left"
      >
        <span className="font-semibold text-slate-900">
          {open
            ? "Supplier Mapped ▾"
            : "Supplier Mapped ▸"}
        </span>
      </button>

      {open && (
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="w-16 px-4 py-2">
                  S.No.
                </th>

                <th className="px-4 py-2">
                  SupplierCode
                </th>

                <th className="px-4 py-2">
                  SupplierName
                </th>

                <th className="px-4 py-2 text-right">
                  Entrants
                </th>

                <th className="px-4 py-2 text-right">
                  In Progress
                </th>

                <th className="px-4 py-2 text-right">
                  Total
                </th>

                <th className="px-4 py-2 text-right">
                  Complete
                </th>

                <th className="px-4 py-2 text-right">
                  Terminate
                </th>

                <th className="px-4 py-2 text-right">
                  OverQuota
                </th>

                <th className="px-4 py-2 text-right">
                  DropOut
                </th>

                <th className="px-4 py-2 text-right">
                  QualityTerm
                </th>

                <th className="px-4 py-2 text-right">
                  Sentry Pass
                </th>

                <th className="px-4 py-2 text-right">
                  Sentry Fail
                </th>

                <th className="px-4 py-2 text-right">
                  Verisoul Pass
                </th>

                <th className="px-4 py-2 text-right">
                  Verisoul Fail
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-slate-500"
                    colSpan={15}
                  >
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map(
                  (row, index) => (
                    <tr
                      key={`${
                        row.supplierCode ||
                        "supplier"
                      }-${index}`}
                      className={
                        index % 2
                          ? "bg-slate-50"
                          : "bg-white"
                      }
                    >
                      <td className="px-4 py-2">
                        {index + 1}
                      </td>

                      <td className="px-4 py-2">
                        {
                          row.supplierCode
                        }
                      </td>

                      <td className="px-4 py-2">
                        {
                          row.supplierName
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.entrants}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.inProgress
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.total}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.complete}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.terminate}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.overQuota}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {row.dropOut}
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.qualityTerm
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.sentryPass
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.sentryFail
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.verisoulPass
                        }
                      </td>

                      <td className="px-4 py-2 text-right">
                        {
                          row.verisoulFail
                        }
                      </td>
                    </tr>
                  )
                )}

              {!loading &&
                rows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-500"
                      colSpan={15}
                    >
                      No suppliers mapped
                      yet.
                    </td>
                  </tr>
                )}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 font-semibold text-white">
                <td
                  className="px-4 py-2"
                  colSpan={3}
                >
                  Total
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.entrants}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.inProgress}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.total}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.complete}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.terminate}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.overQuota}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.dropOut}
                </td>

                <td className="px-4 py-2 text-right">
                  {
                    totals.qualityTerm
                  }
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.sentryPass}
                </td>

                <td className="px-4 py-2 text-right">
                  {totals.sentryFail}
                </td>

                <td className="px-4 py-2 text-right">
                  {
                    totals.verisoulPass
                  }
                </td>

                <td className="px-4 py-2 text-right">
                  {
                    totals.verisoulFail
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}