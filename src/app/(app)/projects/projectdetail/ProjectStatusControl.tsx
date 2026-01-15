"use client";

export const runtime = "edge";

import { useState } from "react";

type Status = "ACTIVE" | "CLOSED";

export default function ProjectStatusControl({
  projectId,
  initialStatus,
}: {
  projectId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  async function updateStatus() {
    try {
      setLoading(true);

      const res = await fetch(`/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Update failed");

      setShowDialog(true);
    } catch {
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="CLOSED">CLOSED</option>
        </select>

        <button
          onClick={updateStatus}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white"
        >
          {loading ? "Updating..." : "Update"}
        </button>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-white p-6">
            <p className="mb-4 text-center font-semibold">
              Project status updated successfully!
            </p>
            <button
              onClick={() => setShowDialog(false)}
              className="mx-auto block rounded-md bg-emerald-600 px-6 py-2 text-sm text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
