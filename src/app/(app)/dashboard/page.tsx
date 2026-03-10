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

  useEffect(() => {
    fetch("/api/projects?page=1&pageSize=5")
      .then((r) => r.json())
      .then((d: ApiResp) => {
        setRows(d.items || []);
        setCounts(
          d.statusCounts || {
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
    <div className="p-6 space-y-6 bg-gray-50">

      {/* ---------- Recent Active Surveys (TOP) ---------- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <CardHeader title="Recent Active Surveys" />

        <div className="p-4">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-blue-900">
                  ProjectCode
                </th>

                <th className="text-left text-blue-900">
                  Name
                </th>

                <th className="text-right text-blue-900" style={{ width: "80px" }}>
                  Count
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-200 last:border-0">
                  <td className="py-2 font-semibold text-black">
                    <a
                      href={`/projects/projectdetail?id=${encodeURIComponent(
                        r.id
                      )}`}
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
      </div>

      {/* ---------- Stat Cards (BOTTOM) ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard label="Active" value={counts.ACTIVE} type="active" />
        <StatusCard label="InActive" value={counts.INACTIVE} type="inactive" />
        <StatusCard label="Closed" value={counts.CLOSED} type="closed" />
      </div>

    </div>
  );
}