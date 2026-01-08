// FILE: src/app/(app)/report/groupreport/GroupReportUI.tsx

"use client";
  
import { useState } from "react";

export default function GroupReportUI({ session }: { session: any }) {
  const [Project, setProject] = useState("");
  const [group, setGroup] = useState("");

  const [showDialog, setShowDialog] = useState(false); //  Dialog State

  const validate = () => {
    if (!Project) {
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
    setProject("");
  };

  return (
    <div className="p-6 w-full">

      {/* Page Title */}
      <h1 className="text-2xl font-semibold mb-4">Group Project Report</h1>

      {/* Main Card */}
      <div className="bg-white p-6 rounded-xl shadow-md border">

        {/* Form Row */}
        <div className="flex items-end gap-6">

          {/* Project Input */}
          <div className="flex flex-col w-1/3">
            <input
              type="text"
              placeholder="Search Group Project"
              className="border rounded-lg h-10 px-3 focus:ring-2 focus:ring-teal-500"
              value={Project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pb-1">
            <button
              onClick={handleView}
             className="bg-teal-600 text-white px-6 h-10 rounded-lg hover:bg-teal-700">
              View
            </button>

            <button
              className="bg-teal-600 text-white px-6 h-10 rounded-lg hover:bg-teal-700">
              Download
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
            <h2 className="text-xl font-semibold mb-6">Please select the Project</h2>

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