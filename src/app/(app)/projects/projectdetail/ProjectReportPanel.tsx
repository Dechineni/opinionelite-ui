
"use client";

import { useState } from "react";

export default function ProjectReportPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [reportType, setReportType] = useState<"project" | "prescreen" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleDownload = () => {
    const url =
      reportType === "project"
        ? `/api/report/project?id=${projectId}`
        : `/api/report/prescreen?id=${projectId}`;

    window.open(url, "_blank");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

      {/* ✅ Top Right Refresh Button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleRefresh}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {loading ? "..." : "↻"}
        </button>
      </div>

      {/* ✅ Report Row */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
        
        {/* Left Side Options */}
        <div className="flex items-center gap-10">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={reportType === "project"}   // ✅ default selected
              onChange={() => setReportType("project")}
            />
            Project Report
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={reportType === "prescreen"}
              onChange={() => setReportType("prescreen")}
            />
            PreScreen Report
          </label>
        </div>

        {/* ✅ Download Button (right side of same line) */}
        <button
          onClick={handleDownload}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Download
        </button>
      </div>

      {/* ✅ Placeholder area */}
      <div className="mt-6 text-center text-sm text-slate-500">
        {reportType === "project"
          ? "Project Report preview will appear here"
          : "PreScreen Report preview will appear here"}
      </div>
    </div>
  );
}
