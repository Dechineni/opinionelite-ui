//FILE : src/app/(app)/support/ip-tracker/page.tsx 
"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function IPTrackerPage() {
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [ip, setIp] = useState("");
  const [showAlert, setShowAlert] = useState(false);


  return (
    <div className="p-4 max-w-full overflow-x-hidden bg-slate-100">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-black">
          IP Tracker
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Blocked IP</span>

          {/* Toggle */}
          <button
            onClick={() => setBlockedOnly(!blockedOnly)}
            className={`relative h-5 w-10 rounded-full transition ${
              blockedOnly ? "bg-teal-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition ${
                blockedOnly ? "translate-x-5" : ""
              }`}
            />
          </button>

          {/* Refresh */}
          <button className="rounded-md bg-teal-600 p-1.5 text-white hover:bg-teal-700">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-md">
        {/* Filters – ONLY show in normal IP Tracker */}
{!blockedOnly && (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
    {/* Search IP */}
    <div>
      <label className="mb-1 block text-sm font-semibold">
        Search IP
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="XXX.XXX.XXX.XXX"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="border border-gray-400 bg-white rounded-md px-3 py-1.5 focus:border-emerald-400 focus:ring-1 focus:ring-teal-500 text-sm w-full"
        />
        <button 
        onClick={() => {
    if (!ip.trim()) {
      setShowAlert(true);
      return;
    }
    // existing search logic later
  }}
        className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
          Search
        </button>
      </div>
    </div>

    {/* Comment */}
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-semibold">
        Comment
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          className="border border-gray-400 bg-white rounded-md px-3 py-1.5 focus:border-teal-400 focus:ring-1 focus:ring-teal-500 text-sm w-full"
        />
        <button 
        onClick={() => {
    if (!ip.trim()) {
      setShowAlert(true);
      return;
    }
    // existing block logic later
  }}
        className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
          Block
        </button>
      </div>
    </div>
  </div>
)}
        {/* Table Controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>Page Size :</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
             className="border border-gray-400 bg-white rounded-md px-2 py-1 focus:border-black">
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
        className="border border-gray-400 bg-white rounded-md px-3 py-1.5 focus:border-teal-400 focus:ring-1 focus:ring-teal-500"


          />
        </div>

        {/* Table */}
<div className="mt-3 overflow-x-auto max-w-full pb-2">

  {/* BLOCKED IP TABLE */}
  {blockedOnly && (
    <table className="min-w-[1000px] border-collapse text-sm">
      <thead className="bg-slate-800 text-white">
        <tr>
          {["S.No.", "IP", "BlockDate", "Comments", "Action"].map((header) => (
            <th
              key={header}
              className="px-3 py-2 text-left font-medium whitespace-nowrap"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        <tr>
          <td
            colSpan={5}
            className="py-4 text-center text-slate-600"
          >
            No Records Found
          </td>
        </tr>
      </tbody>
    </table>
  )}

  {/* NORMAL IP TRACKER TABLE */}
  {!blockedOnly && (
    <table className="min-w-[1000px] border-collapse text-sm">
      <thead className="bg-slate-800 text-white">
        <tr>
          {[
            "S.No.",
            "ProjectCode",
            "ProjectName",
            "SupplierCode",
            "SupplierName",
            "SupplierIdentifier",
            "Status",
            "Date",
            "GeoLocation",
            "DeviceType",
            "BrowserDetail",
          ].map((header) => (
            <th
              key={header}
              className="px-3 py-2 text-left font-medium whitespace-nowrap"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        <tr>
          <td
            colSpan={11}
            className="py-4 text-center text-slate-600"
          >
            No Records Found
          </td>
        </tr>
      </tbody>
    </table>
  )}

</div>

      </div>
      {showAlert && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-[320px] rounded-lg bg-white p-6 text-center shadow-lg">
      <p className="mb-4 text-base font-semibold text-black">
        Please enter ip address
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
