"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface TableRow {
  id: number;
  code: string;
  name: string;
  supplier: string;
  supId: string;
  userId: string;
}

export default function ReconciliationPage() {
  const [pageSize, setPageSize] = useState(10);
  const [identifiers, setIdentifiers] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [isSearched, setIsSearched] = useState(false);
  const [rowStatuses, setRowStatuses] = useState<Record<number, string>>({}); // Track status per row

  const tableData: TableRow[] = [
    {
      id: 1,
      code: "PC001", 
      name: "Test Project",
      supplier: "ABC Supplier",
      supId: "SUP123",
      userId: "USER456",
    },
    {
      id: 2,
      code: "PC002",
      name: "Finance Audit",
      supplier: "Global Vendor",
      supId: "SUP789",
      userId: "USER111",
    },
    {
      id: 3,
      code: "PC003",
      name: "Healthcare Survey",
      supplier: "MedSource",
      supId: "SUP456",
      userId: "USER222",
    },
    {
      id: 4,
      code: "PC004",
      name: "Retail Analysis",
      supplier: "Retail Solutions",
      supId: "SUP678",
      userId: "USER555",
    },
    {
      id: 5,
      code: "PC005",
      name: "Education Research",
      supplier: "EduTech",
      supId: "SUP876",
      userId: "USER666",
    },
  ];

  const handleSearch = () => {
    if (!identifiers.trim()) {
      setShowAlert(true);
      return;
    }

    // Parse identifiers - split by comma and trim whitespace
    const searchTerms = identifiers
      .split(",")
      .map((term) => term.trim().toUpperCase())
      .filter((term) => term.length > 0);

    // Filter table data by matching codes
    const filtered = tableData.filter((row) =>
      searchTerms.includes(row.code.toUpperCase())
    );

    // Append new results to existing filtered data, avoiding duplicates
    const existingIds = new Set(filteredData.map((row) => row.id));
    const newRows = filtered.filter((row) => !existingIds.has(row.id));
    const updatedFilteredData = [...filteredData, ...newRows];

    setFilteredData(updatedFilteredData);
    setIsSearched(true);

    // Add row statuses only for new rows
    const newStatus: Record<number, string> = { ...rowStatuses };
    newRows.forEach((row) => {
      newStatus[row.id] = "Status";
    });
    setRowStatuses(newStatus);
  };

  const handleClear = () => {
    setIdentifiers("");
  };

  const handleClearClick = () => {
    handleClear();
  };

  const handleStatusChange = (rowId: number, newStatus: string) => {
    setRowStatuses({
      ...rowStatuses,
      [rowId]: newStatus,
    });
    setOpenRow(null);
  };

  const handleReconcile = () => {
    // Assign status based on project code
    const newStatus: Record<number, string> = {};
    displayData.forEach((row) => {
      // PC001, PC002, PC003 -> Complete
      // PC004, PC005 -> Quality Terminate
      if (["PC001", "PC002", "PC003"].includes(row.code)) {
        newStatus[row.id] = "Complete";
      } else if (["PC004", "PC005"].includes(row.code)) {
        newStatus[row.id] = "Quality Terminate";
      }
    });
    setRowStatuses(newStatus);
  };

  const displayData = isSearched ? filteredData : [];

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
              placeholder="Enter single or comma-separated identifiers"
              className="mt-auto w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col">
            {/* empty label space */}
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
          </div>

          <input
            type="text"
            placeholder="Search..."
            className="w-full md:w-60 rounded-md border border-gray-300 px-3 py-1.5"
          />
        </div>

        {/* ✅ TABLE SCROLL CONTAINED */}
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

                {/* ✅ STATUS HEADER */}
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
                displayData.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-6 py-3">{row.id}</td>
                    <td className="px-6 py-3">{row.code}</td>
                    <td className="px-6 py-3">{row.name}</td>
                    <td className="px-6 py-3">{row.supplier}</td>
                    <td className="px-6 py-3">{row.supId}</td>
                    <td className="px-6 py-3">{row.userId}</td>

                    {/* STATUS DROPDOWN - Per Row */}
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

      {/* Alert Modal */}
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