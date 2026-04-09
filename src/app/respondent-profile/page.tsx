"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const genderOptions = [
  { value: "", label: "Select gender" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

export default function RespondentProfilePage() {
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId") || "";
  const supplierId = searchParams.get("supplierId") || "";
  const externalId = searchParams.get("id") || "";
  const next = searchParams.get("next") || "";

  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return !!projectId && !!externalId && !!birthDate && !!gender && !submitting;
  }, [projectId, externalId, birthDate, gender, submitting]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!projectId || !externalId) {
      setError("Missing project or respondent information.");
      return;
    }

    if (!birthDate || !gender) {
      setError("Please enter date of birth and gender.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/respondent-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          supplierId: supplierId || null,
          externalId,
          birthDate,
          gender,
          next,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to save profile.");
        setSubmitting(false);
        return;
      }

      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setError("Profile saved, but redirect URL was missing.");
      setSubmitting(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Complete your profile
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Please provide the details below before continuing to the survey.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="birthDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date of Birth
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white"
              required
            >
              {genderOptions.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-black text-white py-2.5 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}