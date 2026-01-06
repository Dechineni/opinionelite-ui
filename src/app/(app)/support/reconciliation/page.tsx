// FILE: src/app/(app)/support/reconciliation/page.tsx
"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function ReconciliationPage() {
  const [pageSize, setPageSize] = useState(10);
  const [identifiers, setIdentifiers] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  return (
    // ✅ CONSTRAIN PAGE TO APP LAYOUT
    <div className="p-4 bg-slate-100 min-h-screen overflow-x-hidden">
      {/* Header */}
      <h1 className="mb-3 text-base font-bold text-black">
        Reconciliation
      </h1>

      {/* Card */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm max-w-full">
        <div className="flex flex-col gap-3 lg:flex-row">
  {/* Search Identifiers */}
  <div className="flex-1 flex flex-col">
    <label className="mb-1 text-sm font-semibold">
      Search Identifiers
    </label>
    <textarea
      rows={4}
      value={identifiers}
      onChange={(e) => setIdentifiers(e.target.value)}
      className="mt-auto w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
    />
  </div>

  {/* Buttons */}
  <div className="flex flex-col">
    {/* empty label space */}
    <div className="mb-1 h-[20px]" />

    <div className="mt-auto flex flex-wrap gap-2">
      <button 
      onClick={() => {
    if (!identifiers.trim()) {
      setShowAlert(true);
      return;
    }
    // existing search logic (if any)
  }}
      className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700">
        Search
      </button>
      <button className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700">
        Clear
      </button>
      <button className="rounded-md bg-gray-400 px-4 py-2 text-sm text-white hover:bg-gray-500">
        Reconcile
      </button>
      <button className="rounded-md bg-gray-400 px-4 py-2 text-sm text-white hover:bg-gray-500">
        Complete
      </button>
      <button className="rounded-md bg-teal-600 p-2 text-white hover:bg-teal-700">
        <Download size={16} />
      </button>
    </div>
  </div>
</div>


        {/* Controls */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span>Page Size :</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1">
              <input type="checkbox" /> C
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" /> SF
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" /> D
            </label>
          </div>

          <input
            type="text"
            placeholder="Search..."
            className="w-full md:w-60 rounded-md border border-gray-300 px-3 py-1.5"
          />
        </div>

        {/* ✅ TABLE SCROLL CONTAINED */}
        <div className="mt-3 overflow-x-auto max-w-full pb-2">
          <table className="min-w-[1000px] border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                {[
                  "S.No.",
                  "Action",
                  "ProjectCode",
                  "ProjectName",
                  "Supplier",
                  "SupplierIdentifier",
                  "UserIdentifier",
                  "Status",
                  "Date",
                  "GeoLocation",
                  "DeviceType",
                  "BrowserDetail",
                  "IsTestLink",
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-gray-300 px-3 py-2 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr>
                <td
                  colSpan={13}
                  className="py-4 text-center text-slate-600"
                >
                  No Records Found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {showAlert && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-[340px] rounded-lg bg-white p-6 text-center shadow-lg">
      <p className="mb-4 text-base font-semibold text-black">
        Please enter valid identifier
      </p>
      <button
        onClick={() => setShowAlert(false)}
        className="rounded-md bg-teal-600 px-6 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        OK
      </button>
    </div>
  </div>
)}

    </div>
  );
}
