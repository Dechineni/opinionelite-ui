
"use client";

import { useState } from "react";

interface Project{
  id : string;
  code : string;
  name : string;
}

export default function ProjectReportPanel({
  projectId,
  project
}: {
  projectId: string;
  project : Project;
}) {
  const [reportType, setReportType] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("")

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  // TIMESTAMP FUNCTION
  const getFormattedTimestamp = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${year}${month}${day}_${hours}${minutes}`;
  };

  const handleDownload = async () => {
      try {

        // GENERATING TIME STAMP AND FILENAME
        const timestamp = getFormattedTimestamp();
        const fileName = `ProjectReport_${project.code}_${timestamp}.xlsx`;

        // IF NO PROJECTID LOG PROJECT ID IS REQUIRED
        if (!projectId) {
          console.log("ProjectId is required");
          return;
        }

        // FOR TESTING 
        if (reportType === "prescreen") {
          setAlertMessage(
            "Prescreen Report is currently on hold and not available for download."
          );
          return;
        }

        // FOR USER NOT SELECT ANY REPORT SHOWING ERROR MESSAGE 
        if (!reportType) {
          setAlertMessage("Please select at least one report type");
          return;
        }

        // WHILE DOWNLOADING THE REPORT THE DOWNLOAD BUTTON WILL CHANGE TO DOWNLOADING...
        if (isDownloading) {
          return;
        }

        setIsDownloading(true);

        // BASED ON THE TYPE API CALL WHILL HAPPEN 
        const url = `/api/projects/${encodeURIComponent(projectId)}/report?type=${encodeURIComponent(reportType)}`;

        // API CALL RESPONSE
        const response = await fetch(url);

        // IF API WILL FAIL SHOWING DOWNLOAD FAILED ERROR
        if (!response.ok) {
            const message = await response.text();
            throw new Error(message);
        }

        // VERIFY THAT THE API RESPONSE IS AN EXCEL FILE BEFORE DOWNLOADING
        const contentType = response.headers.get("content-type");

        if (
          !contentType?.includes(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
        ) {
          throw new Error("Invalid file format");
        }

        // GETTING BOLB RESPONSE
        const blob = await response.blob();

        // DOWNLOAD URL
        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error(
          "Download Error:",
          error
        );
        
        setAlertMessage("Unable to download the report. Please try again.");

      } finally {
        setIsDownloading(false);
      }
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
              value="project"
              name="reportType"
              checked={reportType === "project"}
              onChange={(e) => setReportType(e.target.value)}
            />
            Project Report
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="prescreen"
              name="reportType"
              checked={reportType === "prescreen"}
              onChange={(e) => setReportType(e.target.value)}
            />
            PreScreen Report
          </label>
        </div>

        {/* ✅ Download Button (right side of same line) */}
        <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
          isDownloading
            ? "cursor-not-allowed bg-gray-400"
            : "bg-teal-600 hover:bg-teal-700"
        }`}
      >
        {isDownloading ? "Downloading..." : "Download"}
      </button>
      </div>

      {/* ✅ Placeholder area */}
      <div className="mt-6 text-center text-sm text-slate-500">
        {!reportType
          ? "Please select a report type"
          : reportType === "project"
          ? "Project Report preview will appear here"
          : "PreScreen Report preview will appear here"}
      </div>

      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[340px] rounded-lg bg-white p-6 text-center shadow-lg">
            <p className="mb-4 text-base font-semibold text-black">
              {alertMessage}
            </p>
            <button
              onClick={() => setAlertMessage("")}
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
