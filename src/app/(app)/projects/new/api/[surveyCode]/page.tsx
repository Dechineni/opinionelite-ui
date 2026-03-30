"use client";

import { useParams, useRouter } from "next/navigation";

export default function SurveyDetails() {
  const params = useParams<{ surveyCode: string }>();
  const surveyCode = params.surveyCode;
  const router = useRouter();

  // ✅ SAME STATIC DATA (with targeting added)
  const surveyData = [
    {
      surveyCode: "demo123",
      quotaId: "2468013579",
      name: "Ad-Hoc Survey",
      quota: "15",
      loi: "65",
      ir: "95",
      cpi: "35",
      age: "35-44",
      gender: "Male",
      state: "California",
    },
    {
      surveyCode: "demo124",
      quotaId: "2468013580",
      name: "Health Study",
      quota: "20",
      loi: "30",
      ir: "80",
      cpi: "25",
      age: "25-34",
      gender: "Female",
      state: "Texas",
    },
    {
      surveyCode: "demo125",
      quotaId: "2468013581",
      name: "Tech Survey",
      quota: "10",
      loi: "45",
      ir: "70",
      cpi: "40",
      age: "18-24",
      gender: "Male",
      state: "New York",
    },
    {
      surveyCode: "demo126",
      quotaId: "2468013582",
      name: "Retail Feedback",
      quota: "25",
      loi: "50",
      ir: "60",
      cpi: "20",
      age: "45-54",
      gender: "Female",
      state: "Florida",
    },
    {
      surveyCode: "demo127",
      quotaId: "2468013583",
      name: "Gaming Survey",
      quota: "30",
      loi: "20",
      ir: "85",
      cpi: "15",
      age: "18-30",
      gender: "Male",
      state: "Washington",
    },
  ];

  // ✅ FIND SELECTED SURVEY
  const survey = surveyData.find(
    (item) => item.surveyCode === surveyCode
  );

  // ✅ NOT FOUND CASE
  if (!survey) {
    return <div className="p-6">Survey not found</div>;
  }

  return (
    <div className="p-6 bg-[#f3f4f6] min-h-screen">
      
      {/* BACK BUTTON */}
      <button
        onClick={() => router.back()}
        className="mb-2 bg-black text-white px-3 py-1 rounded"
      >
        ←
      </button>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700">
          Survey Details
        </h1>
      </div>

      {/* CARD */}
      <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">

        <div className="space-y-3 text-sm">

          {[
            ["Survey Code", survey.surveyCode],
            ["QuotaId", survey.quotaId],
            ["Survey Name", survey.name],
            ["Quota", survey.quota],
            ["LOI", survey.loi],
            ["IR", survey.ir],
            ["CPI", survey.cpi],
            ["LiveURL", "https://example.com/live"],
            ["TestURL", "https://example.com/test"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[160px_20px_1fr] items-start"
            >
              <span className="font-semibold text-black">{label}</span>
              <span className="text-black">:</span>
              <span className="text-gray-700 break-all">{value}</span>
            </div>
          ))}

          {/* ✅ TARGETING */}
          <div className="grid grid-cols-[160px_20px_1fr] items-start text-sm">
            <span className="font-semibold text-black">Targeting</span>
            <span className="text-black">:</span>

            <div className="grid grid-cols-[120px_20px_1fr] gap-y-2">
              
              <span className="font-semibold text-black">Age</span>
              <span>:</span>
              <span className="text-gray-700">{survey.age}</span>

              <span className="font-semibold text-black">Gender</span>
              <span>:</span>
              <span className="text-gray-700">{survey.gender}</span>

              <span className="font-semibold text-black">State</span>
              <span>:</span>
              <span className="text-gray-700">{survey.state}</span>

            </div>
          </div>
        </div>

        {/* BUTTON */}
        <div className="flex justify-end mt-6">
          <button className="bg-emerald-600 text-white px-5 py-2 rounded hover:bg-emerald-700">
            Launch
          </button>
        </div>

      </div>
    </div>
  );
}