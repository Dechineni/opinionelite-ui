// FILE: src/app/page.tsx
// Dashboard UI – tuned to match the screenshot (tight cards, 3x stat grid left, conversions card right,
// dark section headers, two-by-two chart/table grid). Tailwind border colors fixed.
//
// Install deps:
//   pnpm add recharts

export const runtime = 'edge';

"use client";

import React from "react";
// import { Search } from "lucide-react";

// ---------- Sample data (replace with API later) ----------
const STATS = [
  { label: "Welcome to", value: "Opinion Elite" },
];

// ---------- UI primitives ----------
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-400" />
        </div>
        <div>
          <div className="text-slate-600">{label}</div>
          <div className="text-1xl font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </Card>
  );
}

// function DonutGauge({ value }: { value: number }) {
//   const size = 140;
//   const stroke = 12;
//   const radius = (size - stroke) / 2;
//   const circumference = 2 * Math.PI * radius;
//   const dash = Math.max(0, Math.min(1, value / 100)) * circumference;
//   return (
//     <div className="flex flex-col items-center">
//       <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
//         <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
//         <circle
//           cx={size / 2}
//           cy={size / 2}
//           r={radius}
//           stroke="#0ea5e9"
//           strokeWidth={stroke}
//           strokeLinecap="round"
//           fill="none"
//           strokeDasharray={`${dash} ${circumference - dash}`}
//           transform={`rotate(-90 ${size / 2} ${size / 2})`}
//         />
//         <text x="50%" y="52%" textAnchor="middle" className="fill-slate-800 text-xl font-semibold">
//           {value.toFixed(2)}%
//         </text>
//       </svg>
//       <div className="mt-1 text-xs text-slate-600">Conversion Ratio</div>
//     </div>
//   );
// }

// ---------- Page ----------
export default function DashboardPage() {
  const todayComplete = 1324;
  const totalClick = 10359;
  const conv = (todayComplete / Math.max(1, totalClick)) * 100;

  return (
    <div className="space-y-4">
      {/* ===== Top: Stats (left) + Conversions Today (right) ===== */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: 3-wide stat grid (two rows) */}
        <div className="col-span-12 xl:col-span-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {STATS.slice(0, 3).map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
          {/* <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {STATS.slice(3).map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div> */}
        </div>

        {/* Right: Conversions Today
        <div className="col-span-12 xl:col-span-4">
          <Card className="h-full">
            <div className="mb-2 text-sm font-semibold text-slate-800">Conversions Today</div>
            <div className="grid grid-cols-2 items-center gap-2">
              <DonutGauge value={conv} />
              <div className="space-y-3">
                <div>
                  <div className="text-3xl font-semibold">{todayComplete.toLocaleString()}</div>
                  <div className="text-sm text-slate-600">Today Complete</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold">{totalClick.toLocaleString()}</div>
                  <div className="text-sm text-slate-600">Total Click</div>
                </div>
              </div>
            </div>
          </Card>
        </div> */}
      </div>
    </div>
  );
}