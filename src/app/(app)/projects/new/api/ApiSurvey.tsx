"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { COUNTRIES } from "@/data/countries";

const clients = [
  { id: "C1016", name: "MorningConsult" },
];

export default function ApiSurvey() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [client, setClient] = useState(
  searchParams.get("client") || ""
);

const [country, setCountry] = useState(
  searchParams.get("country") || ""
);

const [showData, setShowData] = useState(
  !!(searchParams.get("client") && searchParams.get("country"))
);
  const [search, setSearch] = useState("");

  const handleRefresh = () => {
    setClient("");
    setCountry("");
    setShowData(false);
    setSearch("");
  };

  const surveyData = [
  {
    surveyCode: "demo123",
    quotaId: "2468013579",
    name: "Ad-Hoc Survey",
    quota: "15",
    loi: "65",
    ir: "95",
    cpi: "35",
  },
  {
    surveyCode: "demo124",
    quotaId: "2468013580",
    name: "Health Study",
    quota: "20",
    loi: "30",
    ir: "80",
    cpi: "25",
  },
  {
    surveyCode: "demo125",
    quotaId: "2468013581",
    name: "Tech Survey",
    quota: "10",
    loi: "45",
    ir: "70",
    cpi: "40",
  },
  {
    surveyCode: "demo126",
    quotaId: "2468013582",
    name: "Retail Feedback",
    quota: "25",
    loi: "50",
    ir: "60",
    cpi: "20",
  },
  {
    surveyCode: "demo127",
    quotaId: "2468013583",
    name: "Gaming Survey",
    quota: "30",
    loi: "20",
    ir: "85",
    cpi: "15",
  },
];

  return (
    <div className="p-6 bg-[#f3f4f6] min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700">
          Survey List
        </h1>

        <button
          onClick={handleRefresh}
          className="bg-emerald-600 text-white px-3 py-2 rounded flex items-center gap-2 hover:bg-emerald-700"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-sm relative">
        {/* FILTERS */}
        <div className="grid grid-cols-3 gap-6 items-end">

          {/* Client */}
          <div>
            <label className="text-sm font-semibold text-black">
              Client<span className="text-red-500">*</span>
            </label>
            <select
              className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">-- Select Client --</option>
              {clients.map((c) => (
                <option key={c.id}>
                  {c.id} : {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ SELECT COUNTRY (MATCHES GROUP UI) */}
          <div>
            <label className="text-sm font-semibold text-black">
              Select Country<span className="text-red-500">*</span>
            </label>
            <select
              className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">-- Select Country --</option>

              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advance Search */}
          <div className="text-sm font-semibold text-black cursor-pointer">
            + Advance Search
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={() => {
  if (client && country) {
    setShowData(true);

    router.replace(
      `?client=${client}&country=${country}`
    );
  }
}}
            className="bg-emerald-600 text-white px-6 py-2 rounded text-sm hover:bg-emerald-700"
          >
            View
          </button>

          <button
            onClick={handleRefresh}
            className="bg-emerald-600 text-white px-6 py-2 rounded text-sm hover:bg-emerald-700"
          >
            Reset
          </button>
        </div>

        {/* CONTROLS */}
        <div className="flex justify-between items-center mt-6 mb-3">
          <div className="text-sm font-semibold text-black">
            Page Size :
            <select className="ml-2 border border-gray-300 px-2 py-1 rounded text-sm">
              <option>10</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Search..."
            className="border border-gray-300 px-3 py-1 rounded text-sm font-semibold text-black placeholder-black"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* TABLE */}
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-[#1f2a44] text-white">
            <tr>
              <th className="py-2 text-center">S.No.</th>
              <th className="py-2 text-center">SurveyCode</th>
              <th className="py-2 text-center">QuotaId</th>
              <th className="py-2 text-center">SurveyName</th>
              <th className="py-2 text-center">Quota</th>
              <th className="py-2 text-center">LOI</th>
              <th className="py-2 text-center">IR</th>
              <th className="py-2 text-center">CPI</th>
            </tr>
          </thead>

          <tbody>
            {!showData ? (
              <tr>
                <td colSpan={7} className="text-center py-6 font-semibold text-black">
                  No Records Found
                </td>
              </tr>
            ) : (
              surveyData.map((survey, index) => (
  <tr key={survey.surveyCode} className="border-t hover:bg-gray-50">
    <td className="text-center py-2">{index + 1}</td>

    <td
      className="text-center py-2 text-emerald-600 font-medium cursor-pointer hover:underline"
      onClick={() =>
        router.push(`/projects/new/api/${survey.surveyCode}`)
      }
    >
      {survey.surveyCode}
    </td>

    <td className="text-center py-2">{survey.quotaId}</td>
    <td className="text-center py-2">{survey.name}</td>
    <td className="text-center py-2">{survey.quota}</td>
    <td className="text-center py-2">{survey.loi}</td>
    <td className="text-center py-2">{survey.ir}</td>
    <td className="text-center py-2">{survey.cpi}</td>
  </tr>
))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}