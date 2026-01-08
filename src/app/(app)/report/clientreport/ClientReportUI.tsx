// FILE: src/app/(app)/report/clientreport/ClientReportUI.tsx

"use client";

import { useState } from "react";

export default function ClientReportUI({ session }: { session: any }) {
  const [client, setClient] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showDialog, setShowDialog] = useState(false); //  Dialog State

  const validate = () => {
    if (!client || !fromDate || !toDate) {
      setShowDialog(true);
      return false;
    }
    return true;
  };

  const handleView = () => {
    if (!validate()) return;
    console.log("VIEW REPORT");
  };

  const handleDownload = () => {
    if (!validate()) return;
    console.log("DOWNLOAD REPORT");
  };

  const handleReset = () => {
    setClient("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="p-6 w-full">

      {/* Page Title */}
      <h1 className="text-2xl font-semibold mb-4">Client Report</h1>

      {/* Main Card */}
      <div className="bg-white p-6 rounded-xl shadow-md border">

        {/* Form Row */}
        <div className="flex items-end gap-6">

          {/* Client Input */}
          <div className="flex flex-col w-1/3">
            <label className="font-medium mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Search Client"
              className="border rounded-lg h-10 px-3 focus:ring-2 focus:ring-teal-500"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
          </div>

          {/* From Date */}
          <div className="flex flex-col w-1/4">
            <label className="font-medium mb-1">
              From <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              placeholder="From Date"
              className="border rounded-lg h-10 px-3 focus:ring-2 focus:ring-teal-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          {/* To Date */}
          <div className="flex flex-col w-1/4">
            <label className="font-medium mb-1">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              placeholder="To Date"
              className="border rounded-lg h-10 px-3 focus:ring-2 focus:ring-teal-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleView}
             className="bg-teal-600 text-white px-6 h-10 rounded-lg hover:bg-teal-700">
              View
            </button>

            <button
              onClick={handleDownload}
              className="bg-teal-600 text-white px-6 h-10 rounded-lg hover:bg-teal-700">
              Download
            </button>

            <button
              onClick={handleReset}
              className="bg-teal-600 text-white px-6 h-10 rounded-lg hover:bg-teal-700">
              Reset
            </button>
          </div>
        </div>
      </div>
      {/* =========================== */}
      {/*   Required Fields Dialog    */}
      {/* =========================== */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-[360px] text-center">
            <h2 className="text-xl font-semibold mb-6">All fields required !</h2>
 
            <button
              onClick={() => setShowDialog(false)}
              className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}