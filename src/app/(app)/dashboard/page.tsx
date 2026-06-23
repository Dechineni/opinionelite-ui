//src/app/(app)/dashboard/page.tsx
// Dashboard UI – tuned to match the screenshot (tight cards, 3x stat grid left, conversions card right,
// dark section headers, two-by-two chart/table grid). Tailwind border colors fixed.
// Install deps: //pnpm add recharts

"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
import { CalendarCheck, ClipboardX, FileX } from "lucide-react";

type ProjectStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "CLOSED";

type ApiProject = {
  c: number;
  id: string;
  code: string;
  name: string;
};

type ApiResp = {
  items: ApiProject[];
  total: number;
  statusCounts: Record<ProjectStatus, number>;
};

/* ---------- Card Header ---------- */
const CardHeader = ({ title }: { title: string }) => (
  <div className="bg-slate-700 text-white px-4 py-2 rounded-t-xl font-semibold text-sm">
    {title}
  </div>
);

/* ---------- Status Card ---------- */
function StatusCard({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "active" | "inactive" | "closed";
}) {
  const styles = {
    active: {
      bg: "bg-emerald-100",
      icon: <CalendarCheck className="text-emerald-600" size={20} />,
    },
    inactive: {
      bg: "bg-orange-100",
      icon: <ClipboardX className="text-orange-500" size={20} />,
    },
    closed: {
      bg: "bg-gray-100",
      icon: <FileX className="text-gray-500" size={20} />,
    },
  };

  const s = styles[type];

  return (
    <div className="bg-white rounded-xl p-4 flex items-center justify-between shadow">
      
      {/* Left icon */}
      <div className={`p-2 rounded-lg ${s.bg}`}>
        {s.icon}
      </div>

      {/* Right text */}
      <div className="flex flex-col items-end">
        <span className="text-sm text-blue-900">{label}</span>
        <span className="text-xl font-semibold text-black">{value}</span>
      </div>

    </div>
  );
}

/* ---------- Dashboard ---------- */
export default function DashboardPage() {
  const [rows, setRows] = useState<ApiProject[]>([]);
  const [counts, setCounts] = useState<Record<ProjectStatus, number>>({
    ACTIVE: 0,
    INACTIVE: 0,
    CLOSED: 0,
  });
  const [apiRows, setApiRows] = useState<ApiProject[]>([]);
  const [apiCounts, setApiCounts] = useState<Record<ProjectStatus, number>>({
    ACTIVE: 0,
    INACTIVE: 0,
    CLOSED: 0,
  });

  useEffect(() => {
    // fetch recent projects and recent API projects in parallel
    Promise.all([
      fetch("/api/projects?page=1&pageSize=5").then((r) => r.json()),
      fetch("/api/api-projects?page=1&pageSize=5").then((r) => r.json()),
    ])
      .then(([projResp, apiResp]: [ApiResp, ApiResp]) => {
        setRows(projResp.items || []);
        setCounts(
          projResp.statusCounts || {
            ACTIVE: 0,
            INACTIVE: 0,
            CLOSED: 0,
          }
        );

        setApiRows(apiResp.items || []);
        setApiCounts(
          apiResp.statusCounts || {
            ACTIVE: 0,
            INACTIVE: 0,
            CLOSED: 0,
          }
        );
      })
      .catch((err) => {
        console.error("Failed to load dashboard data:", err);
      });
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* ---------- Recent Active Surveys + API Project List ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <div className="bg-white rounded-xl shadow overflow-hidden flex flex-col h-full">
          <CardHeader title="Recent Project List Surveys" />

          <div className="p-4 overflow-y-auto flex-1">
            <table className="w-full text-sm h-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-blue-900">ProjectCode</th>
                  <th className="text-left text-blue-900">Name</th>
                  <th className="text-right text-blue-900" style={{ width: "80px" }}>Count</th>
                </tr>
              </thead>
              <tbody className="h-full">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 last:border-0">
                    <td className="py-2 font-semibold text-black">
                      <a
                        href={`/projects/projectdetail?id=${encodeURIComponent(r.id)}`}
                        className="font-semibold text-black hover:text-emerald-700 hover:underline transition-colors"
                      >
                        {r.code}
                      </a>
                    </td>
                    <td>{r.name}</td>
                    <td className="text-right" style={{ width: "80px" }}>
                      {r.c ?? 0}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500 italic">
                      No recent active surveys
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard label="Active" value={counts.ACTIVE} type="active" />
              <StatusCard label="InActive" value={counts.INACTIVE} type="inactive" />
              <StatusCard label="Closed" value={counts.CLOSED} type="closed" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden flex flex-col h-full">
          <CardHeader title="Recent API Project List Surveys" />

          <div className="p-4 overflow-y-auto flex-1">
            <table className="w-full text-sm h-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-blue-900">ProjectCode</th>
                  <th className="text-left text-blue-900">Name</th>
                  <th className="text-right text-blue-900" style={{ width: "80px" }}>Count</th>
                </tr>
              </thead>
              <tbody className="h-full">
                {apiRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 last:border-0">
                    <td className="py-2 font-semibold text-black">
                      <a
                        href={`/projects/projectdetail?id=${encodeURIComponent(r.id)}&from=apiprojects`}
                        className="font-semibold text-black hover:text-emerald-700 hover:underline transition-colors"
                      >
                        {r.code}
                      </a>
                    </td>
                    <td>{r.name}</td>
                    <td className="text-right" style={{ width: "80px" }}>
                      {r.c ?? 0}
                    </td>
                  </tr>
                ))}

                {apiRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500 italic">
                      No recent API projects
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard label="Active" value={apiCounts.ACTIVE} type="active" />
              <StatusCard label="InActive" value={apiCounts.INACTIVE} type="inactive" />
              <StatusCard label="Closed" value={apiCounts.CLOSED} type="closed" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}