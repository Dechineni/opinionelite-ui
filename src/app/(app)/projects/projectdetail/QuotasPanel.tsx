"use client"

import React, {useState} from "react";
import { RefreshCw, Plus, Info, Search, SquareCheck, Trash2, ExternalLink, Grip } from "lucide-react";

export default function QuotasPanel(){
    const [activeTab, setActiveTab] = useState("quotas");
    return(
        <div className="quotas-main-container rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

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

            <div className="quotas-count-container flex rounded-xl border border-slate-200 bg-white p-4 shadow-sm mt-3">

                <div className="border-r-2 w-90 text-gray-300">
                    <h1 className="font-medium text-gray-500 text-sm">Total Quota Count</h1>
                    <h1 className="font-bold text-black mt-1.5 text-xl">1,000</h1>
                    <h1 className="font-medium text-gray-500 text-sm mt-1.5">100.00%</h1>
                </div>
                <div className="px-7">
                    <h1 className="font-medium text-gray-500 text-sm">Total Completes</h1>
                    <h1 className="font-bold text-black mt-1.5 text-xl">623</h1>
                    <h1 className="font-medium text-gray-500 text-sm mt-1.5">62.30%</h1>
                </div>
            </div>

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
                            <Plus size={16} />
                            Clone
                        </button>

                        <button
                            type="button"
                            className="flex items-center gap-1 h-[35px] px-3 rounded-md bg-white text-blue-500 border text-sm font-medium cursor-pointer"
                        >
                            <Plus size={16} />
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
              
        </div>
    )
};