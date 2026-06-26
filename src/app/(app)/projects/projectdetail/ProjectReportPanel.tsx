
"use client";

import { useState } from "react";
// import * as XLSX from "xlsx";
// import ExcelJS from "exceljs";

export default function ProjectReportPanel({
  projectId
}: {
  projectId: string;
}) {
  const [reportType, setReportType] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  // TIMESTAMP FUNCTION
  // const getFormattedTimestamp = () => {
  //   const now = new Date();

  //   const year = now.getFullYear();
  //   const month = String(now.getMonth() + 1).padStart(2, "0");
  //   const day = String(now.getDate()).padStart(2, "0");

  //   const hours = String(now.getHours()).padStart(2, "0");
  //   const minutes = String(now.getMinutes()).padStart(2, "0");

  //   return `${year}${month}${day}_${hours}${minutes}`;
  // };

  

  const handleDownload = async () => {
    try {
      if (!projectId) {
        console.log("ProjectId is required")
      }

      console.log("Selected Report from line number 206@@@@@@@@@@@@@@:", reportType);
      const url = `/api/projects/${projectId}/report?type=${reportType}`;

      const response = await fetch(url)

      if (!response.ok) {
        console.log("Error generating report")
      }

      const reportData = await response.json();

      console.log("Report Data from line number 72@@@@@@@@@@@@@@@@@@:", reportData);
    }
    catch (error) {
      console.error("Download Error :", error)
    }
  }

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
              value="project"
              checked={reportType === "project"}
              onChange={(e) => setReportType(e.target.value)}
            />
            Project Report
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="prescreen"
              checked={reportType === "prescreen"}
              onChange={(e) => setReportType(e.target.value)}
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
