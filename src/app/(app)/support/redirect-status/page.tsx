//FILE : src/app/(app)/support/redirect-status/page.tsx 
"use client"; 

export default function RedirectStatusPage() {
  return (
    <div className="p-4 bg-slate-100 min-h-screen">
      {/* Page Title */}
      <h1 className="mb-3 text-base font-bold text-black">
        Redirect Status
      </h1>

      {/* Card */}
      <div className="rounded-xl bg-white p-4 shadow-md border border-gray-200">
        {/* Table Wrapper */}
        <div className="overflow-y-auto max-h-[520px]">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-slate-800 text-white border-b border-gray-300">
              <tr className="border-b border-gray-300">
                <th className="px-3 py-2 text-left">S.No.</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-center">
                  Redirect To Supplier Status
                </th>
              </tr>
            </thead>

            <tbody>
              {[
                [1, "C", "Complete", "Survey Completed", "C"],
                [2, "T", "Terminate", "Client side Terminate", "T"],
                [3, "Q", "Over Quota", "Client side Over Quota", "Q"],
                [4, "F", "Quality Terminate", "Client side Quality Terminate", "F"],
                [5, "D", "Drop Out", "Client side Drop Out", "NA"],
                [6, "A", "Active", "Active", "NA"],
                [7, "R", "Rejected Identifier", "Token Upload", "NA"],
                [8, "QC", "Duplicate Supplier User", "Duplication – Supplier UID", "F"],
                [9, "QA", "Duplicate IP", "Unique IP", "F"],
                [10, "QE", "GEO IP Mismatch", "GEO IP Mismatch", "F"],
                [11, "QD", "Device Validation", "Device Type", "F"],
                [12, "QB", "Browser Validation", "Browser Detail", "F"],
                [13, "QT", "Test Link", "Test Link", "F"],
                [14, "S", "Screened Out", "Screened Out", "S"],
                [15, "N", "No Redirect", "No Redirect", "NA"],
                [16, "E", "Error", "Survey Error", "NA"],
                [17, "P", "Partial", "Partial Survey", "NA"],
                [18, "L", "Link Expired", "Link Expired", "NA"],
                [19, "X", "Survey Not Started", "Survey Not Started", "NA"],
                [20, "U", "Unknown", "Unknown Status", "NA"],
              ].map((row, idx) => (
                <tr
                  key={idx}
                  className="even:bg-slate-100 border-b border-gray-300 last:border-b-0"
                >
                  <td className="px-3 py-2">{row[0]}</td>
                  <td className="px-3 py-2">{row[1]}</td>
                  <td className="px-3 py-2">{row[2]}</td>
                  <td className="px-3 py-2">{row[3]}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {row[4]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
