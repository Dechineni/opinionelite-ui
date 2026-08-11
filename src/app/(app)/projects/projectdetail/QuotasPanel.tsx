"use client"

import React, {useState, useEffect } from "react";
import { RefreshCw, Plus, Info, Search, SquareCheck, Trash2, ExternalLink, Grip, MoreVertical, GripVertical, Copy, Network } from "lucide-react";

export default function QuotasPanel({ projectId }: { projectId: string }) {
    const [activeTab, setActiveTab] = useState("quotas");

    const [quotas, setQuotas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadQuotas = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/projects/${projectId}/quotas`,
                {
                    cache: "no-store",
                }
            );
            const data = await response.json();
            setQuotas(
                Array.isArray(data?.items) ? data.items : []
            );
        } catch (error) {
            console.error("Error loading quotas:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQuotas();
    }, [projectId]);

    return(
        <div className="quotas-main-container rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
           
           {/* Quotas Heading Section */}
            <div className="quotas-heading-container flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        Project Quotas <Info size={16} />
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Create and manage quotas for your project
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={loadQuotas}
                        className="flex items-center justify-center gap-1.5 w-[100px] h-[35px] rounded-md border border-gray-300 bg-white text-sm font-medium cursor-pointer"
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>

                    <button
                        type="button"
                        className="flex items-center gap-1.5 h-[35px] px-4 rounded-md bg-blue-600 text-white text-sm font-medium cursor-pointer"
                    >
                        <Plus size={16} />
                        Add Quota
                    </button>
                </div>
            </div>
           
            {/* Quotas Count Section */}
            <div className="quotas-count-container flex rounded-xl border border-slate-200 bg-white p-3 shadow-sm mt-3 w-full">

                <div className="flex-1 border-r border-slate-300 mr-3">
                    <h1 className="font-medium text-gray-500 text-sm">Total Quota Count</h1>
                    <h1 className="font-bold text-black mt-1.5 text-xl">1,000</h1>
                    <h1 className="font-medium text-gray-500 text-sm mt-1.5">100.00%</h1>
                </div>
                <div className="flex-1">
                    <h1 className="font-medium text-gray-500 text-sm">Total Completes</h1>
                    <h1 className="font-bold text-black mt-1.5 text-xl">623</h1>
                    <h1 className="font-medium text-gray-500 text-sm mt-1.5">62.30%</h1>
                </div>
                
            </div>
            
            {/* Quotas Button Section */}
            <div className="quotas-buttons-container w-full mt-5">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("quotas")}
                        className={`px-4 py-2 ${
                            activeTab === "quotas"
                                ? "text-blue-600 border-b-2 border-blue-600 font-medium"
                                : "text-gray-500"
                        }`}
                    >
                        Quotas
                    </button>
                </div>
                <hr className="border border-gray-200 mt-[-1]"/>
            </div>
            
            {/* Quotas Filters Section */}
            <div className="quotas-filters-container mt-2 p-3 flex w-full">
                <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center h-[35px] w-[220px] rounded-md border border-gray-300 px-3 gap-2">
                        <Search size={16} className="text-gray-500" />
                        <input
                            type="text"
                            className="flex-1 text-sm outline-none"
                            placeholder="Search quotas..."
                        />
                    </div>

                    <select className="flex items-center h-[35px] w-[120px] rounded-md border border-gray-300 px-3">
                        <option className="text-sm">All Status</option>
                        <option className="text-sm">Open</option>
                        <option className="text-sm">Close</option>
                        <option className="text-sm">Clone</option>
                        <option className="text-sm">Demographics</option>
                        <option className="text-sm">Delete</option>
                    </select>

                    <div className="ml-5 flex gap-1.5">
                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                        >
                            <ExternalLink size={14} />
                            Open
                        </button>

                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                        >
                            <SquareCheck size={14} />
                            Close
                        </button>

                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                            >
                            <Copy size={14} />
                            Clone
                        </button>

                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                        >
                            <Network size={14} />
                            Demographics
                        </button>

                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-red-500 border text-sm font-medium cursor-pointer"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    </div>

                    <button
                        type="button"
                        className="ml-auto flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                    >
                        <Grip size={14} />
                        Save Order
                    </button>
                </div>
            </div>

            {/* Quotas Table Section */}
            <div className="quotas-filters-container">
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-left text-gray-700">
                                <th className="px-3 py-3">
                                    <input type="checkbox" />
                                </th>
                                <th className="px-2 py-3"></th>
                                <th className="px-3 py-3">#</th>
                                <th className="px-3 py-3">Quota Name</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Target Completes</th>
                                <th className="px-3 py-3">Quota Count</th>
                                <th className="px-3 py-3">Quota %</th>
                                <th className="px-3 py-3">Total Accesses</th>
                                <th className="px-3 py-3">Presc. Clicks</th>
                                <th className="px-3 py-3">Completes</th>
                                <th className="px-3 py-3">Terminates</th>
                                <th className="px-3 py-3">Over Quotas</th>
                                <th className="px-3 py-3 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={14} className="text-center py-4">
                                        Loading quotas...
                                    </td>
                                </tr>
                            ) : quotas.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="text-center py-4">
                                        No quotas synced yet. Use the Sync action from
                                        the Prescreen tab to create quotas from mapped
                                        options.
                                    </td>
                                </tr>
                            ) : (
                                 quotas.map((quota, index) => (
                                    <tr
                                        key={quota.id}
                                        className="border-b border-gray-200"
                                    >
                                    <td className="px-3 py-4">
                                        <input type="checkbox" />
                                    </td>

                                    <td className="px-2 py-4">
                                        <GripVertical
                                            size={16}
                                            className="text-gray-400 cursor-move"
                                        />
                                    </td>

                                    <td className="px-3 py-4">{index + 1}</td>

                                    <td className="px-3 py-4">
                                        <span className="font-medium text-blue-600 cursor-pointer">
                                            {quota.quotaName}
                                        </span>
                                    </td>

                                    <td className="px-3 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-md text-xs font-medium ${quota.status === "Open"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            {quota.status}
                                        </span>
                                    </td>

                                    <td className="px-3 py-4">
                                        {quota.targetCompletes}
                                    </td>

                                    <td className="px-3 py-4">
                                        {quota.quotaCount}
                                    </td>

                                    <td className="px-3 py-4">
                                        {Number(quota.quotaPercent ?? 0).toFixed(2)}%
                                    </td>

                                    <td className="px-3 py-4">
                                        {quota.totalAccesses.toLocaleString()}
                                    </td>

                                    <td className="px-3 py-4">
                                        {quota.prescreenClicks?.toLocaleString()}
                                    </td>

                                    <td className="px-3 py-4">
                                        <span className="text-blue-600 font-semibold cursor-pointer">
                                            {quota.completes}
                                        </span>
                                    </td>

                                    <td className="px-3 py-4">
                                        {quota.terminates}
                                    </td>

                                    <td
                                        className={`px-3 py-4 font-medium ${quota.overQuotas > 0
                                                ? "text-red-500"
                                                : "text-gray-700"
                                            }`}
                                    >
                                        {quota.overQuotas}
                                    </td>

                                    <td className="px-3 py-4 text-center">
                                        <button>
                                            <MoreVertical
                                                size={18}
                                                className="text-gray-500"
                                            />
                                        </button>
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Section */}
            <div className="flex items-center justify-between border border-t-0 border-slate-200 rounded-b-lg px-4 py-3 text-sm bg-white">
                <div className="text-gray-500">
                    Showing 1 to 7 of 7 quotas
                </div>

                <div className="flex items-center gap-3">
                    <button className="w-8 h-8 border rounded text-gray-400">
                        ‹
                    </button>

                    <button className="w-8 h-8 border rounded bg-blue-50 border-blue-600 text-blue-600 font-medium">
                        1
                    </button>

                    <button className="w-8 h-8 border rounded text-gray-400">
                        ›
                    </button>

                    <select className="h-8 border rounded px-2">
                        <option>10 / page</option>
                    </select>
                </div>
            </div>  

        </div>
    )
};