"use client"
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function IptrackerPage(){
  const [pageSize, setPageSize] = useState(10);
  const [showBlocked, setShowBlocked] = useState(false);
  const [searchIP, setSearchIP] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [responseData, setResponseData] = useState([]);


  const handleSearch = async() =>{
    if(!searchIP.trim()){
      setShowAlert(true);
      return 
    }

    setShowAlert(false);

    try{
      const response = await fetch('/api/iptracker' , {
        method : "POST",
        headers : {"Content-Type" : "application/json"},
        body : JSON.stringify({
          searchIp : searchIP
        })
      })

      const data = await response.json();

      if(!response.ok)
      {
        throw new Error(data.message || "Failed to Fatch Data")
      }

      setResponseData(data);
    }
    catch(error)
    {
      console.error("Search IP's Error :", error)
    }
  }

   return(
    <div className="p-4 bg-slate-100 min-h-screen overflow-x-hidden">

      {/* TOP HEADING AND TOGGLE SECTION */}
      <div className="flex justify-between">
        <h1 className="mb-3 text-base font-bold text-black">IP Tracker</h1>

        {/* TOGGLE BUTTON BLOCKED IP'S */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold">Blocked IPs</span>

          <button
            type="button"
            onClick={() => setShowBlocked(!showBlocked)}
            className={`relative h-6 w-12 rounded-full transition-colors duration-300 ${
              showBlocked ? "bg-teal-600" : "bg-gray-400"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                showBlocked ? "left-7" : "left-1"
              }`}
            />
          </button>

          {/* RELOAD BUTTON */}
          <button className="p-2 rounded-md px-2 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700">
            <RefreshCw size={15} className="text-white"/>
          </button>
        </div>

      </div>
      
      {/* IP TRACKER BACKGROUND CARD */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm max-w-auto">

        {/* INPUTS SEARCH IP AND COMMENTS SECTION ENABLED THIS TWO INPUTS WHEN BLOCKED IP IS FALSE*/}
        {!showBlocked &&(
            <>
                <div className=" flex gap-7">

                    {/* LEFT SECTION */}
                    <div className="w-1/2">
                        <label className="mb-1 text-sm font-semibold">Search IP</label>
                        <div className="flex gap-3">
                        <input type="text" value={searchIP} onChange={(e) => setSearchIP(e.target.value)} placeholder="XXX.XXX.XXX.XXX" className="p-2 border border-slate-600 rounded-md flex-1"/>
                        <button className="rounded-md px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700" onClick={handleSearch} >Search</button>
                        </div>
                    </div>

                    {/* RIGHT SECTION */}
                    <div className="flex-1">
                        <label className="mb-1 text-sm font-semibold">Comment</label>
                        <div className="flex gap-3">
                        <input type="text" className="p-2 border border-slate-600 rounded-md flex-1" />
                        <button className="rounded-md px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700">Block</button>
                        </div>
                    </div>

                </div>
            </>
        ) }
        
        {/* PAGES AND SEARCH SECTION */}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span>Page Size :</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Search..."
            className="w-full md:w-60 rounded-md border border-gray-300 px-3 py-1.5"
          />
        </div>

        {/* TABLE DATA*/}
        {!showBlocked ? (
          <div className="mt-4 overflow-x-auto max-w-full pb-2">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-2 text-left">S.No.</th>
                <th className="px-4 py-2 text-left">ProjectCode</th>
                <th className="px-4 py-2 text-left">ProjectName</th>
                <th className="px-4 py-2 text-left">SupplierCode</th>
                <th className="px-4 py-2 text-left">SupplierName</th>
                <th className="px-4 py-2 text-left">SupplierIdentifier</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">GeoLocation</th>
                <th className="px-4 py-2 text-left">DeviceType</th>
                <th className="px-4 py-2 text-left">BrowserDetail</th>
              </tr>
            </thead>
            <tbody>
              {responseData.length === 0 ? (
                <tr>
                  <td colSpan={11}  className="px-6 py-6 text-center text-sm text-gray-500">
                    No Records Found
                  </td>
                </tr>
              ) : (
                <h1>Data</h1>
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="mt-4 overflow-x-auto max-w-full pb-2">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-2 text-left">S.No.</th>
                <th className="px-4 py-2 text-left">IP</th>
                <th className="px-4 py-2 text-left">BlockData</th>
                <th className="px-4 py-2 text-left">Comments</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {responseData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                    No Records Found
                  </td>
                </tr>
              ) : (
                <h1>Data</h1>
              )}
            </tbody>
          </table>
        </div>)}
      </div>

      {/* ALERT MESSAGE FOR NO IP ADDRESS */}
      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[340px] rounded-lg bg-white p-6 text-center shadow-lg">
            <p className="mb-4 text-base font-semibold text-black">
              Please enter ip address
            </p>
            <button
              onClick={() => setShowAlert(false)}
              className="rounded-md bg-teal-600 px-6 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
    
   )
}