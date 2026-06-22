// File: src/app/(app)/projects/ApiProjectList.tsx

"use client";

export const runtime = "edge";

import React, { useEffect, useState } from "react";

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
  status: ProjectStatus;
  countryCode: string;
  languageCode: string;
  currency: string;
  loi: number;
  ir: number;
  sampleSize: number;
  projectCpi: string;
  supplierCpi: string | null;
  startDate: string;
  endDate: string;

  clientName?: string | null;

  // SupplierEntry lifecycle counts
  entrants?: number;
  inProgress?: number;

  c?: number;
  t?: number;
  q?: number;
  d?: number;

  surveyCode?: string;
  quotaId?: string;
  providerType?: string;
};

type ApiResp = {
  items: ApiProject[];
  total: number;
  statusCounts: Record<ProjectStatus, number>;
};

const emptyStatusCounts: Record<ProjectStatus, number> = {
  ACTIVE: 0,
  INACTIVE: 0,
  CLOSED: 0,
  INVOICED: 0,
  BID: 0,
};

export default function ApiProjectList() {
  const [q, setQ] = useState("");

  const [status, setStatus] = useState<
    ProjectStatus | "ALL"
  >("ALL");

  const [page, setPage] = useState(1);

  const pageSize = 10;

  const [rows, setRows] = useState<ApiProject[]>([]);

  const [total, setTotal] = useState(0);

  const [counts, setCounts] = useState<
    Record<ProjectStatus, number>
  >(emptyStatusCounts);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    const url =
      `/api/api-projects?q=${encodeURIComponent(
        q
      )}&page=${page}&pageSize=${pageSize}` +
      (status === "ALL"
        ? ""
        : `&status=${status}`);

    fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load API projects: ${response.status}`
          );
        }

        return response.json();
      })
      .then((data: ApiResp) => {
        setRows(data.items || []);
        setTotal(data.total || 0);

        setCounts(
          data.statusCounts || emptyStatusCounts
        );
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error(
            "Failed to load API projects:",
            error
          );

          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [q, page, status]);

  const pill = (
    label: string,
    value: number | undefined,
    active = false
  ) => (
    <button
      type="button"
      onClick={() => {
        setStatus(
          label as ProjectStatus | "ALL"
        );

        setPage(1);
      }}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-emerald-600 text-white"
          : "border border-slate-200 bg-white text-slate-800"
      }`}
    >
      {label}

      {value !== undefined
        ? `-${value}`
        : ""}
    </button>
  );

  /*
   * S.No.
   * ProjectCode
   * ProjectName
   * ClientName
   * Provider
   * SurveyCode
   * QuotaId
   * ProjectManager
   * LOI
   * IR%
   * Entrants
   * In Progress
   * C
   * T
   * Q
   * D
   * CPI
   */
  const COLS = 17;

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          API Projects
        </h1>

        {pill(
          "ALL",
          undefined,
          status === "ALL"
        )}

        {pill(
          "ACTIVE",
          counts.ACTIVE,
          status === "ACTIVE"
        )}

        {pill(
          "INACTIVE",
          counts.INACTIVE,
          status === "INACTIVE"
        )}

        {pill(
          "CLOSED",
          counts.CLOSED,
          status === "CLOSED"
        )}

        {pill(
          "INVOICED",
          counts.INVOICED,
          status === "INVOICED"
        )}

        {pill(
          "BID",
          counts.BID,
          status === "BID"
        )}

        <input
          className="ml-auto w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search..."
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-800 text-white">
              <tr>
                <td className="px-4 py-3">
                  S.No.
                </td>

                <td className="px-4 py-3">
                  ProjectCode
                </td>

                <td className="px-4 py-3">
                  ProjectName
                </td>

                <td className="px-4 py-3">
                  ClientName
                </td>

                <td className="px-4 py-3">
                  Provider
                </td>

                <td className="px-4 py-3">
                  SurveyCode
                </td>

                <td className="px-4 py-3">
                  QuotaId
                </td>

                <td className="px-4 py-3">
                  ProjectManager
                </td>

                <td className="px-4 py-3 text-right">
                  LOI
                </td>

                <td className="px-4 py-3 text-right">
                  IR%
                </td>

                <td className="px-4 py-3 text-right">
                  Entrants
                </td>

                <td className="px-4 py-3 text-right">
                  In Progress
                </td>

                <td className="px-4 py-3 text-right">
                  C
                </td>

                <td className="px-4 py-3 text-right">
                  T
                </td>

                <td className="px-4 py-3 text-right">
                  Q
                </td>

                <td className="px-4 py-3 text-right">
                  D
                </td>

                <td className="px-4 py-3 text-right">
                  CPI
                </td>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={COLS}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={
                      index % 2
                        ? "bg-slate-50"
                        : "bg-white"
                    }
                  >
                    <td className="px-4 py-3">
                      {(page - 1) *
                        pageSize +
                        index +
                        1}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      <a
                        href={`/projects/projectdetail?id=${encodeURIComponent(
                          row.id
                        )}&from=apiprojectlist`}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        {row.code}
                      </a>
                    </td>

                    <td className="px-4 py-3">
                      {row.name}
                    </td>

                    <td className="px-4 py-3">
                      {row.clientName ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {row.providerType ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {row.surveyCode ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {row.quotaId ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {row.managerEmail}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.loi}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.ir}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.entrants ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.inProgress ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.c ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.t ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.q ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.d ?? 0}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.projectCpi}
                    </td>
                  </tr>
                ))}

              {!loading &&
                rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLS}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No API projects found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-slate-200 px-3 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            «
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() =>
              setPage(
                Math.max(1, page - 1)
              )
            }
            disabled={page === 1}
          >
            ‹
          </button>

          <span className="px-2 text-sm">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() =>
              setPage(
                Math.min(
                  totalPages,
                  page + 1
                )
              )
            }
            disabled={page === totalPages}
          >
            ›
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            onClick={() =>
              setPage(totalPages)
            }
            disabled={page === totalPages}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}