// FILE: src/app/(app)/client/AddClient.tsx
export const runtime = 'edge';

"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/data/countries";

/* ------------------------------ tiny UI bits ------------------------------ */
const Label = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1 block text-xs font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-500">*</span>}
  </label>
);

const Field = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`col-span-12 md:col-span-6 xl:col-span-4 ${className}`}>{children}</div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={[
      "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={[
      "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

/* ------------------------------- component ------------------------------- */
export default function AddClient() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // success dialog
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientName: "",
    contactPerson: "",
    country: "",
    email: "",
    contactNumber: "",
    website: "",
  });
  const update = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const COUNTRY_OPTS = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.clientName,
          contactPerson: form.contactPerson,
          countryCode: form.country,
          email: form.email || null,
          contactNumber: form.contactNumber || null,
          website: form.website || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const created = await res.json().catch(() => ({}));

      // capture for dialog
      setCreatedName(created?.name ?? form.clientName);
      setCreatedCode(created?.code ?? null);
      setSuccessOpen(true);
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const closeSuccess = () => {
    setSuccessOpen(false);
    // go to your client list page; tweak the path if needed
    router.replace("/client/new/clientlist");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Add Client</h1>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-12 gap-6">
          <Field>
            <Label required>Client Name</Label>
            <Input
              value={form.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              required
            />
          </Field>

          <Field>
            <Label required>Contact Person</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => update("contactPerson", e.target.value)}
              required
            />
          </Field>

          <Field>
            <Label required>Country</Label>
            <Select
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              required
            >
              <option value="">-- Select Country --</option>
              {COUNTRY_OPTS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Email ID</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>

          <Field>
            <Label>Contact Number</Label>
            <Input
              type="tel"
              value={form.contactNumber}
              onChange={(e) => update("contactNumber", e.target.value)}
            />
          </Field>

          <Field>
            <Label>Website URL</Label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => history.back()}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Submit"}
          </button>
        </div>
      </form>

      {/* -------- Success Dialog -------- */}
      {successOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <div className="mb-3 text-lg font-semibold text-slate-900">
              Client created successfully!
            </div>
            {createdName && (
              <div className="mb-2 text-sm text-slate-700">
                <span className="font-medium">{createdName}</span>
                {createdCode ? <span className="text-slate-500"> &nbsp;({createdCode})</span> : null}
              </div>
            )}
            <button
              type="button"
              onClick={closeSuccess}
              className="mt-2 inline-flex min-w-[80px] justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}