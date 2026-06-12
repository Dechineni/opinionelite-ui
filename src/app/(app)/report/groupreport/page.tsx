// // FILE: src/app/(app)/report/groupreport/page.tsx
// 'use client';

// import { useState } from 'react';

// export default function GroupReportForm() {
//   const [groupProject, setGroupProject] = useState('');
//   const [showPopup, setShowPopup] = useState(false);

//   // Validation
//   const validateFields = () => {
//     if (!groupProject) {
//       setShowPopup(true);
//       return false;
//     }
//     return true;
//   };

//   // View
//   const handleView = () => {
//     if (!validateFields()) return;
//     console.log({ groupProject });
//   };

//   // Download
//   const handleDownload = () => {
//     if (!validateFields()) return;
//     console.log('Download Group Report');
//   };

//   return (
//     <div className="space-y-4 p-6 bg-gray-50 min-h-screen">
//       <h1 className="text-lg font-semibold">Group Project Report</h1>

//       {/* Card */}
      
//       <div className="bg-white shadow-md rounded-lg p-4 flex flex-wrap gap-4 items-end">

//         {/* Input */}
//         <div className="flex flex-col">
//           <input
//             value={groupProject}
//             onChange={(e) => setGroupProject(e.target.value)}
//             placeholder="Search Group Project"
//             className="border rounded px-3 py-2 w-150"
//           />
//         </div>
      

//         {/* Buttons */}
//         <div>
//         <div className="ml-auto">
//         <div className="flex flex-wrap gap-2">
//           <button
//             onClick={handleView}
//             className="bg-teal-700 text-white px-6 py-2 w-24 rounded hover:bg-teal-800"
//           >
//             View
//           </button>

//           <button
//             onClick={handleDownload}
//             className="bg-teal-700 text-white px-6 py-2 w-35 rounded hover:bg-teal-800"
//           >
//             Download
//           </button>
//         </div>
//         </div>
//         </div>
//         </div>
      

//       {/* Popup (UPDATED) */}
//       {showPopup && (
//         <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          
//           <div className="bg-white rounded-lg shadow-lg p-6 w-[360px] text-center">

//             {/* Message EXACT like design */}
//             <h3 className="text-lg font-semibold mb-6">
//               Please select the Project
//             </h3>

//             {/* Styled button (border + teal) */}
//             <button
//               onClick={() => setShowPopup(false)}
//               className="bg-teal-600 text-white px-6 py-2 rounded 
//                          border-2 border-teal-300 hover:bg-teal-700"
//             >
//               OK
//             </button>

//           </div>

//         </div>
//       )}
//     </div>
//   );
// }


export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import GroupReportForm from "./GroupReportForm";

export default async function GroupReport() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return <GroupReportForm />;
}