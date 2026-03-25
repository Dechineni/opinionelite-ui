//src/app/(app)/support/reconciliation/page.tsx

"use client";

import { useState } from "react";

interface TableRow {
  id: string; // Use pid as unique id
  projectCode: string;
  projectName: string;
  supplier: string;
  supplierIdentifier: string;
  userIdentifier: string; // pid
}

export default function ReconciliationPage() {
  const [pageSize, setPageSize] = useState(10);
  const [identifiers, setIdentifiers] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [isSearched, setIsSearched] = useState(false);
  const [rowStatuses, setRowStatuses] = useState<Record<string, string>>({});

  const handleSearch = async () => {
    if (!identifiers.trim()) {
      setShowAlert(true);
      return;
    }

    const searchTerms = identifiers
      .split(",")
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    // Track existing IDs (prevents duplicates)
    const existingIds = new Set(filteredData.map((row) => row.id));

    const results: TableRow[] = [];
    const newStatus: Record<string, string> = { ...rowStatuses };

    for (const id of searchTerms) {
      // Skip if already exists
      if (existingIds.has(id)) continue;

      try {
        const res = await fetch("/api/reconciliation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchIdentifier: id }),
        });

        if (res.ok) {
          const data = await res.json();
          const pid = data.userIdentifier || id;

          // Double safety check
          if (existingIds.has(pid)) continue;

          const row: TableRow = {
            id: pid,
            projectCode: data.projectCode || "-",
            projectName: data.projectName || "-",
            supplier: data.supplier || "-",
            supplierIdentifier: data.supplierIdentifier || "-",
            userIdentifier: pid,
          };

          results.push(row);
          newStatus[pid] = "Status";// always default on search
          existingIds.add(pid);
        }
      } catch (e) {
        console.error("Fetch error:", e);
      }
    }

    // Merge without duplicates
    setFilteredData((prev) => [...prev, ...results]);
    setRowStatuses(newStatus);
    setIsSearched(true);
  };

  const handleClear = () => {
    setIdentifiers("");
    setFilteredData([]);
    setRowStatuses({});
    setIsSearched(false);
    setOpenRow(null);
  };

  const handleClearClick = () => {
    handleClear();
  };

  const handleStatusChange = (rowId: string, newStatus: string) => {
    setRowStatuses({
      ...rowStatuses,
      [rowId]: newStatus,
    });
    setOpenRow(null);
  };

  const displayData = isSearched ? filteredData.slice(0, pageSize) : [];

  const handleReconcile = async () => {
    const newStatus: Record<string, string> = { ...rowStatuses };

    await Promise.all(
      displayData.map(async (row) => {
        try {
          const res = await fetch("/api/reconciliation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              searchIdentifier: row.userIdentifier, // pid
              action: "reconcile",
            }),
          });

          if (res.ok) {
            const data = await res.json();
            newStatus[row.id] = data.status || "Status";
          }
        } catch (e) {
          console.error("Reconcile error:", e);
        }
      })
    );

    setRowStatuses({ ...newStatus });
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen overflow-x-hidden">
      <h1 className="mb-3 text-base font-bold text-black">Reconciliation</h1>

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm max-w-full">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1 flex flex-col">
            <label className="mb-1 text-sm font-semibold">Search Identifiers</label>
            <textarea
              rows={4}
              value={identifiers}
              onChange={(e) => setIdentifiers(e.target.value)}
              placeholder="Enter single or comma-separated pid values"
              className="mt-auto w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </div>

          <div className="flex flex-col">
            <div className="mb-1 h-[20px]" />

            <div className="mt-auto flex flex-wrap gap-2">
              <button
                onClick={handleSearch}
                className="rounded-md px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700"
              >
                Search
              </button>
              <button
                onClick={handleClearClick}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700"
              >
                Clear
              </button>
              <button
                onClick={handleReconcile}
                disabled={displayData.length === 0}
                className={`rounded-md px-4 py-2 text-sm text-white ${
                  displayData.length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                Reconcile
              </button>
            </div>
          </div>
        </div>

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
          </div>

          <input
            type="text"
            placeholder="Search..."
            className="w-full md:w-60 rounded-md border border-gray-300 px-3 py-1.5"
          />
        </div>

        <div className="mt-3 overflow-x-auto max-w-full pb-2">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-6 py-3 text-left">S.No.</th>
                <th className="px-6 py-3 text-left">ProjectCode</th>
                <th className="px-6 py-3 text-left">ProjectName</th>
                <th className="px-6 py-3 text-left">Supplier</th>
                <th className="px-6 py-3 text-left">SupplierIdentifier</th>
                <th className="px-6 py-3 text-left">UserIdentifier</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {displayData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-6 text-center text-sm text-gray-500"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                displayData.map((row, idx) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-6 py-3">{idx + 1}</td>
                    <td className="px-6 py-3">{row.projectCode}</td>
                    <td className="px-6 py-3">{row.projectName}</td>
                    <td className="px-6 py-3">{row.supplier}</td>
                    <td className="px-6 py-3">{row.supplierIdentifier}</td>
                    <td className="px-6 py-3">{row.userIdentifier}</td>

                    <td className="px-6 py-3 relative overflow-visible">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenRow(openRow === row.id ? null : row.id)}
                          className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-sm font-medium hover:bg-slate-200"
                        >
                          {rowStatuses[row.id] || "Status"}
                          <span className="text-xs">▼</span>
                        </button>

                        {openRow === row.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-md border bg-white shadow-lg z-50">
                            <button
                              onClick={() => {
                                handleStatusChange(row.id, "Complete");
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                            >
                              Complete
                            </button>

                            <button
                              onClick={() => {
                                handleStatusChange(row.id, "Quality Terminate");
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                            >
                              Quality Terminate
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
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