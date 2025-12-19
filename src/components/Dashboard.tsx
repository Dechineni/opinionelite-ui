// FILE: src/components/Dashboard.tsx
"use client";

import React from "react";
import "./Dashboard.css";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from "recharts";
import {
  FileCheck,
  FileX,
  FileMinus,
  FileText,
  FileSignature,
} from "lucide-react";

/* ========= CUSTOM LEGENDS ========= */

const SquareLegend = ({ payload }: any) => (
  <div className="flex justify-center gap-6 mt-4">
    {payload?.map((item: any, index: number) => (
      <div key={index} className="flex items-center gap-2">
        <span
          style={{
            width: 12,
            height: 12,
            backgroundColor: item.color,
          }}
        />
        <span className="text-sm font-medium text-black">
          {item.value.charAt(0).toUpperCase() + item.value.slice(1)}
        </span>
      </div>
    ))}
  </div>
);

const CircleLegend = ({ payload }: any) => (
  <div className="flex justify-center gap-6 mt-4">
    {payload?.map((item: any, index: number) => (
      <div key={index} className="flex items-center gap-2">
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: item.color,
          }}
        />
        <span className="text-sm font-medium text-black">
          {item.value.charAt(0).toUpperCase() + item.value.slice(1)}
        </span>
      </div>
    ))}
  </div>
);


/* ===================== DATA OF ALL GRAPHS(BAR GRAPH, LINE GRAPH) ===================== */
const monthlyData = [
  { month: "Jul-2025", click: 350000, complete: 15000 },
  { month: "Aug-2025", click: 620000, complete: 45000 },
  { month: "Sep-2025", click: 480000, complete: 20000 },
  { month: "Oct-2025", click: 390000, complete: 18000 },
  { month: "Nov-2025", click: 470000, complete: 30000 },
  { month: "Dec-2025", click: 160000, complete: 12000 },
];

const tsignmonthlyData = [
  { month: "Jul-2025", click: 350000, failure: 8000 },
  { month: "Aug-2025", click: 620000, failure: 15000 },
  { month: "Sep-2025", click: 480000, failure: 10000 },
  { month: "Oct-2025", click: 390000, failure: 9000 },
  { month: "Nov-2025", click: 470000, failure: 12000 },
  { month: "Dec-2025", click: 160000, failure: 4000 },
];

const dailyTrend = [
  { day: "25-Nov", click: 18000, failure: 300 },
  { day: "26-Nov", click: 15000, failure: 400 },
  { day: "27-Nov", click: 10000, failure: 350 },
  { day: "28-Nov", click: 14000, failure: 500 },
  { day: "29-Nov", click: 13000, failure: 450 },
  { day: "30-Nov", click: 17000, failure: 600 },
  { day: "01-Dec", click: 16000, failure: 550 },
  { day: "02-Dec", click: 19000, failure: 700 },
];

/* ===================== COMMON HEADER ===================== */
const CardHeader = ({ title }: { title: string }) => (
  <div className="bg-slate-700 text-white px-4 py-2 rounded-t-xl font-semibold text-sm">
    {title}
  </div>
);

/* ===================== STAT CARD ===================== */
const Stat = ({ icon, title, value, iconBg }: any) => (
  <div className="bg-white rounded-xl p-4 flex items-center gap-3 shadow">
    <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
    <div>
      <div className="text-xs text-black">{title}</div>
      <div className="text-xl font-semibold text-gray-500">{value}</div>
    </div>
  </div>
);

/* ===================== DASHBOARD ===================== */
export default function Dashboard() {
  return (
    <div className="p-6 space-y-6 bg-gray-50">

      {/* ===================== ROW 1 ===================== */}

<div className="grid grid-cols-2 gap-6 items-start">

  {/* LEFT : STAT CARDS */}
  <div className="grid grid-cols-3 gap-4 mt-[56px]">
    {/* row 1 */}
    <Stat
      icon={<FileCheck size={20} />}
      title="Active"
      value="689"
      iconBg="bg-emerald-100 text-emerald-600"
    />
    <Stat
      icon={<FileX size={20} />}
      title="InActive"
      value="381"
      iconBg="bg-orange-100 text-orange-500"
    />
    <Stat
      icon={<FileMinus size={20} />}
      title="Closed"
      value="1162"
      iconBg="bg-gray-100 text-gray-500"
    />

    {/* row 2 */}
    <Stat
      icon={<FileText size={20} />}
      title="Invoiced"
      value="1563"
      iconBg="bg-indigo-100 text-indigo-500"
    />
    <Stat
      icon={<FileSignature size={20} />}
      title="Bid"
      value="131"
      iconBg="bg-lime-100 text-lime-600"
    />
  </div>

  {/* RIGHT : SEARCH + CONVERSIONS */}
  <div className="space-y-4">

    {/* SEARCH BAR (RIGHT SIDE ONLY) */}
    <input
      type="text"
      placeholder="Search"
      className="w-full h-10 px-4 text-sm rounded-md bg-white border border-gray-200 shadow-sm focus:border-black focus:ring-2 focus:ring-black"
    />

    <div className="bg-white rounded-xl shadow p-6">
      <h4 className="font-semibold mb-4">Conversions Today</h4>

      <div className="flex justify-center items-center gap-20">
        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-500">1089</div>
          <div className="text-xs text-black">Today Complete</div>
        </div>

        {/* RATIO CIRCLE */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg width="144" height="144">
            <circle cx="72" cy="72" r="60" stroke="#e5e7eb" strokeWidth="10" fill="none" />
              <circle cx="72" cy="72" r="60" stroke="#c08457" strokeWidth="10" fill="none" strokeDasharray="377" strokeDashoffset="324" transform="rotate(-90 72 72)"/>
          </svg>
          <div className="absolute text-center">
            <div className="text-xl font-semibold">14.02%</div>
            <div className="text-xs text-black">Conversion Ratio</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-500">7765</div>
          <div className="text-xs text-black">Total Click</div>
        </div>
      </div>
    </div>
  </div>
</div>

      {/* ===================== ROW 2 ===================== */}
      {/* LEFT: MONTHLY COMPLETES BAR GRAPH */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <CardHeader title="Monthly Completes" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top:20, right:20, left:40, bottom:10 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" interval={0} 
                tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }}
                tickMargin={8}
                axisLine={{ stroke: "#9ca3af" }}
                tickLine={{ stroke: "#9ca3af" }}/>

                <YAxis width={38}
                tick={{ fill: "#374151", fontSize: 12 }}
                tickMargin={4}>
                <Label value="(Counts)" angle={-90} position="insideLeft" offset={-30} 
                style={{textAnchor: "middle", fill: "#000000", fontWeight: 600, fontSize: 12}}/>
                </YAxis>

                <Tooltip/>
                <Legend verticalAlign="bottom" align="center" content={<SquareLegend />}/>
                <Bar dataKey="click" fill="#0d9488" radius={[4,4,0,0]} />
                <Bar dataKey="complete" fill="#a3e635" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* RIGHT: RECENT ACTIVE SURVEYS TABLE */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <CardHeader title="Recent Active Surveys" />
          <div className="p-4">
            <table className="w-full text-sm"
                   style={{tableLayout: "fixed"}}> 
              
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-blue-900">ProjectCode</th>
                  <th className="text-left text-blue-900">Name</th>
                  <th className="text-right text-blue-900"
                      style={{ width: "80px" }}>Count</th>
                </tr>
              </thead>
              <tbody>
  {[
    { code: "SR2512", name: "Allwyn Q4 2025", count: 0 },
    { code: "SR2511", name: "25-12204", count: 0 },
    { code: "SR2510", name: "SCPO 1056865", count: 4 },
    { code: "SR2509", name: "Allwyn Q3 2025", count: 0 },
    { code: "SR2508", name: "25-12104", count: 3 },
    { code: "SR2507", name: "SCPO 1055865", count: 2 },
  ].map((row) => (
    <tr key={row.code} className="border-b border-gray-200 last:border-0">
      <td className="py-2 font-semibold text-black">{row.code}</td>
      <td>{row.name}</td>
      <td className="text-right"
          style={{ width: "80px" }}>{row.count}</td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================== ROW 3 ===================== */}
      {/* LEFT: TSIGN DAILY TREND LINE GRAPH */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <CardHeader title="Tsign Daily Trend" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
              data={dailyTrend}
              margin={{ top: 20, right: 20, bottom: 10, left: 40 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis
              dataKey="day" interval={0} 
              tick={{fill: "#374151", fontSize: 12, fontWeight: 500}}
            tickMargin={8}
            axisLine={{ stroke: "#9ca3af" }}
            tickLine={{ stroke: "#9ca3af" }}/>

              <YAxis
              width={38}
              tick={{ fill: "#374151", fontSize: 12 }}
              tickMargin={4}>
              <Label value="(Counts)" angle={-90} position="insideLeft" offset={-30} 
              style={{fill: "#000", fontWeight: 600, fontSize: 12, textAnchor: "middle"}}/>
              </YAxis>
              <Tooltip />
              <Legend verticalAlign="bottom" align="center" content={<CircleLegend />}/>

            {/* CLICK LINE */}
            <Line type="linear" dataKey="click" stroke="#0d9488" strokeWidth={2} dot={false} activeDot={false}/>

            {/* FAILURE LINE */}
            <Line type="linear" dataKey="failure" stroke="#a3e635" strokeWidth={2} dot={false} activeDot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* RIGHT: TSIGN MONTHLY TREND BAR GRAPH */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <CardHeader title="Tsign Monthly Trend" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tsignmonthlyData} margin={{ right:20, left:40, bottom:10, top:20 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" interval={0} 
                tick={{fill: "#374151", fontSize: 12, fontWeight: 500}}
                tickMargin={8}
                axisLine={{ stroke: "#9ca3af" }}
                tickLine={{ stroke: "#9ca3af" }}/>

                <YAxis width={38}
                tick={{ fill: "#374151", fontSize: 12 }}
                tickMargin={4}>
                <Label value="(Counts)" angle={-90} position="insideLeft" offset={-30} 
                style={{textAnchor: "middle", fill: "#000000", fontWeight: 600, fontSize: 12}}/>
                </YAxis>
                <Tooltip />
                <Legend verticalAlign="bottom" align="center" content={<CircleLegend />}/>
                <Bar dataKey="click" fill="#0d9488" radius={[4,4,0,0]} />
                <Bar dataKey="failure" fill="#a3e635" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}