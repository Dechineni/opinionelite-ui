'use client';

import { useState } from 'react';

export default function GroupReportForm() {
  const [groupProject, setGroupProject] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  // Validation
  const validateFields = () => {
    if (!groupProject) {
      setShowPopup(true);
      return false;
    }
    return true;
  };

  // View
  const handleView = () => {
    if (!validateFields()) return;
    console.log({ groupProject });
  };

  // Download
  const handleDownload = () => {
    if (!validateFields()) return;
    console.log('Download Group Report');
  };

  return (
    <div className="space-y-4 bg-white min-h-screen">
      <h1 className="text-lg font-semibold">Group Project Report</h1>

      {/* Card */}
      
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 px-4 py-8 flex flex-wrap gap-4 items-end">

        {/* Input */}
        <div className="flex flex-col">
          <input
            value={groupProject}
            onChange={(e) => setGroupProject(e.target.value)}
            placeholder="Search Group Project"
            className="w-150 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      

        {/* Buttons */}
        <div>
        <div className="ml-auto">
        <div className="flex flex-wrap gap-2">
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
        </div>
        </div>
        </div>
        </div>
      

      {/* Popup (UPDATED) */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          
          <div className="bg-white rounded-lg shadow-lg p-6 w-[360px] text-center">

            {/* Message EXACT like design */}
            <h3 className="text-lg font-semibold mb-6">
              Please select the Project
            </h3>

            {/* Styled button (border + teal) */}
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