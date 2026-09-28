"use client";

import { useState, useEffect } from "react";

type Client = {
  id: string;
  code: string;
  name: string;
};

type ClientReportRow = {
  sNo: number;
  clientName: string;
  clientCode: string;
  projectCode: string;
  surveyName: string;
  hashIdentifier: string;
  supplierId: string;
  supplierName: string;
  supplierIdentifier: string;
  statusDescription: string;
  startDateTime: string | Date | null;
  endDateTime: string | Date | null;
  loi: number | string | null;
};

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    console.error(
      "Client Report API returned non-JSON response:",
      text.slice(0, 500)
    );

    throw new Error(
      `Client Report API returned an invalid response. Status: ${response.status}`
    );
  }

  return response.json();
}

export default function ClientReportForm() {
  const [client, setClient] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientReportData, setClientReportData] = useState<ClientReportRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // FETCH CLIENTS DATA
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(
          "/api/client?mode=lite&page=1&pageSize=1000"
        );

        if (!response.ok) {
          throw new Error("Unable to load clients");
        }

        const data = await response.json();
        setClients(data.items || []);
      } catch (error) {
        setErrorMessage("Unable to load clients");
      }
    };

    fetchClients();
  }, []);

  // Validation function
  const validateFields = () => {
    if (!client || !fromDate || !toDate) {
      setShowPopup(true);
      return false;
    }

    return true;
  };

  // FETCHREPORTPAGE FUNCTION
  const fetchReportPage = async(pageNumber : number, selectedPageSize = pageSize) =>{

    setLoading(true);
    setErrorMessage("");
    setClientReportData([]);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        clientId: client,
        from: fromDate,
        to: toDate,
        format: "json",
        page : String(pageNumber),
        pageSize : String(selectedPageSize)
      });

      const response = await fetch(`/api/reports/client?${params}`);
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          "Failed to load report data."
        );
      }

      setClientReportData(data?.data || data?.rows || []);
      setTotalRows(data.totalRows || 0);
      setTotalPages(data.totalPages || 0);
      setPage(data.page || pageNumber);
      setPageSize(data.pageSize || selectedPageSize);
    } catch (error: any) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // View
  const handleView = async () => {
    if (!validateFields()) return;

    setHasSearched(true);
    setPage(1);
    await fetchReportPage(1, pageSize);
  };

  // Download
  const handleDownload = async () => {
    if (!validateFields()) return;

    setDownloading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        clientId: client,
        from: fromDate,
        to: toDate,
        format: "xlsx",
      });

      const selectedClient = clients.find(
        (c) => c.id === client
      );

      const fileName = `ClientReport_${selectedClient?.code}_${fromDate}_to_${toDate}.xlsx`;

      const response = await fetch(`/api/reports/client?${params}`);
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();

          throw new Error(
            errorData?.message ||
            errorData?.error ||
            "Unable to download the report. Please try again."
          );
        }

        const text = await response.text();
        console.error(
          "Client Report download failed with non-JSON response:",
          text.slice(0, 500)
        );

        throw new Error(
          `Unable to download the report. Server returned status ${response.status}.`
        );
      }

      if (contentType.includes("application/json")) {
        const data = await response.json();

        throw new Error(
          data?.message ||
          data?.error ||
          "Report cannot be downloaded."
        );
      }

      if (
        !contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ) {
        throw new Error("Invalid file format received.");
      }

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      setErrorMessage(error.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  // Reset
  const handleReset = () => {
    setClient("");
    setFromDate("");
    setToDate("");

    // clear preview report rows
    setClientReportData([]);
    setPage(1);
    setPageSize(100);
    setTotalRows(0);
    setTotalPages(0);

    // clear messages
    setErrorMessage("");
    setHasSearched(false);

    // close validation popup
    setShowPopup(false);
  };

  // HANDLEPREVIOUSPAGE FUNCTION
  const handlePreviousPage = async () => {
  if (page <= 1) return;

  await fetchReportPage(page - 1, pageSize);
  };

  // HANDLENEXTPAGE FUNCTION
  const handleNextPage = async () => {
    if (page >= totalPages) return;

    await fetchReportPage(page + 1, pageSize);
  };

  // HANDLEPAGESIZECHANGE FUNCTION
  const handlePageSizeChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newPageSize = Number(e.target.value);

    setPageSize(newPageSize);
    setPage(1);

    if (hasSearched) {
      await fetchReportPage(1, newPageSize);
    }
  };

  return (
    <div className="space-y-4 bg-white min-h-screen w-full">
      <h1 className="text-lg font-semibold">Client Report</h1>

      {/* Form Card */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 px-4 py-6 flex flex-wrap gap-4 items-end min-w-0">
        {/* Client */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">Select Client</option>
            {clients.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* From */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            From <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* To */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium">
            To <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Buttons */}
        <div>
          <div className="ml-auto">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleView}
                disabled={loading || downloading}
                className="rounded-lg bg-emerald-600 px-4 py-2 w-25 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "Loading..." : "View"}
              </button>

              <button
                onClick={handleDownload}
                disabled={loading || downloading}
                className="rounded-lg bg-emerald-600 px-4 py-2 w-30 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {downloading ? "Downloading..." : "Download"}
              </button>

              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 w-25 text-sm text-gray-700 hover:bg-gray-100"
              >
                Reset
              </button>
            </div>
          </div>
          
        </div>

        {errorMessage && (
          <div className="w-full rounded-md bg-red-100 border border-red-300 text-red-700 px-4 py-3 mt-4">
            {errorMessage}
          </div>
        )}

        {/* CLIENT REPORT TABLE */}
        <div className="w-full">
          <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
            <div className="w-full overflow-x-auto">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="min-w-[1800px] w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                    <tr>
                      <th className="px-1 py-3 whitespace-nowrap">S.No.</th>
                      <th className="px-1 py-3 whitespace-nowrap">Client Name</th>
                      <th className="px-1 py-3 whitespace-nowrap">Client Code</th>
                      <th className="px-1 py-3 whitespace-nowrap">Project Code</th>
                      <th className="px-1 py-3 whitespace-nowrap">Survey Name</th>
                      <th className="px-1 py-3 whitespace-nowrap">Hash Identifier</th>
                      <th className="px-1 py-3 whitespace-nowrap">Supplier Id</th>
                      <th className="px-1 py-3 whitespace-nowrap">Supplier Name</th>
                      <th className="px-1 py-3 whitespace-nowrap">Supplier Identifier</th>
                      <th className="px-1 py-3 whitespace-nowrap">Status Description</th>
                      <th className="px-1 py-3 whitespace-nowrap">Start Date Time</th>
                      <th className="px-1 py-3 whitespace-nowrap">End Date Time</th>
                      <th className="px-1 py-3 whitespace-nowrap">LOI</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={13} className="px-2 py-8 text-center">
                          Loading report...
                        </td>
                      </tr>
                    ) : clientReportData?.length > 0 ? (
                      clientReportData.map((item, index) => (
                        <tr
                          key={`${item.hashIdentifier || "no-hash"}-${index}`}
                          className="border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="px-2 py-3 whitespace-nowrap">{item.sNo}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.clientName}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.clientCode}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.projectCode}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.surveyName}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.hashIdentifier}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.supplierId}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.supplierName}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.supplierIdentifier}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{item.statusDescription}</td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.startDateTime
                              ? new Date(item.startDateTime).toLocaleString()
                              : "-"}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.endDateTime
                              ? new Date(item.endDateTime).toLocaleString()
                              : ""}
                          </td>

                          <td className="px-2 py-3 whitespace-nowrap">{item.loi ?? ""}</td>
                        </tr>
                      ))
                    ) : hasSearched ? (
                      <tr>
                        <td
                          colSpan={13}
                          className="px-2 py-4 text-center text-slate-500"
                        >
                          No report data found for selected criteria.
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td
                          colSpan={13}
                          className="px-2 py-4 text-center text-slate-500"
                        >
                          No Data Found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {hasSearched && (
          <div className="w-full mt-4 border-t border-slate-200 pt-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              {/* TOTAL ROWS SECTION */}
              <div className="text-sm font-medium text-slate-700">
                Total Rows: {totalRows.toLocaleString()}
              </div>

              {/* PAGINATION CONTROLS PREVIOUS AND NEXT BUTTONS AND PAGES ALSO */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-sm font-medium text-slate-700">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              {/* PAGE SIZE SECTION */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Page Size
                </label>

                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[350px] text-center">
            <h3 className="text-lg font-semibold mb-6">
              All fields required !
            </h3>

            <button
              onClick={() => setShowPopup(false)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
