'use client';

import { useState } from 'react';

export default function SupplierReportForm() {
  const [supplier, setSupplier] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Validation
  const validateFields = () => {
    if (!supplier || !fromDate || !toDate) {
      setShowPopup(true);
      return false;
    }
    return true;
  };

  const handleView = () => {
    if (!validateFields()) return;
    console.log({ supplier, fromDate, toDate });
  };

  const handleDownload = () => {
    if (!validateFields()) return;
    console.log('Download Supplier Report');
  };

  const handleReset = () => {
    setSupplier('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-4 bg-white min-h-screen">
      <h1 className="text-lg font-semibold">Supplier Report</h1>

      {/* Card */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 px-4 py-6 flex flex-wrap gap-4 items-end">

        {/* Supplier */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            Supplier <span className="text-red-500">*</span>
          </label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Search Supplier"
            className="w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* From */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            From <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* To */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            To <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Buttons */}
        <div>
        <div className="ml-auto">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleView}
              className="rounded-lg bg-emerald-600 px-4 py-2 w-25 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              View
            </button>

            <button
              onClick={handleDownload}
              className="rounded-lg bg-emerald-600 px-4 py-2 w-30 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Download
            </button>

            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 w-25 text-sm text-gray-700 hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[350px] text-center">

            <h3 className="text-lg font-semibold mb-6">
              All fields required !
            </h3>

            <button
              onClick={() => setShowPopup(false)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              OK
            </button>

          </div>
        </div>
      )}
    </div>
  );
}