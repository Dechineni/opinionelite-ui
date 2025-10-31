// FILE: src/app/(app)/supplier/AddSupplier.tsx
"use client";
export const runtime = 'edge';

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/data/countries";
import { Plus, X } from "lucide-react";

/* ----------------------------- tiny UI helpers ----------------------------- */
const Label = ({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="mb-1 block text-xs font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-500">*</span>}
  </label>
);

const Field = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`col-span-12 md:col-span-6 xl:col-span-4 ${className}`}>{children}</div>;

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

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={[
      "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

// Reusable little copy-hint row beneath a URL input
function CopyableHint({ example }: { example: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
    } catch {
      // ignore
    }
  };
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
      <span>Link eg.</span>
      <button
        type="button"
        onClick={copy}
        className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:bg-slate-50"
        title="Copy example"
      >
        Copy
      </button>
      <span className="truncate">{example}</span>
    </div>
  );
}

/* ------------------------------- success modal ------------------------------ */
function SuccessModal({
  open,
  code,
  onClose,
}: {
  open: boolean;
  code?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="text-lg font-semibold">Supplier created successfully!</div>
        {code ? <div className="mt-1 text-sm text-slate-600">Supplier Code: <b>{code}</b></div> : null}
        <div className="mt-4 flex justify-center">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */
export default function AddSupplier() {
  const router = useRouter();

  const [form, setForm] = useState({
    supplierName: "",
    website: "",
    country: "",
    email: "",
    contactNumber: "",
    panelSize: "",
    completeUrl: "",
    terminateUrl: "",
    overQuotaUrl: "",
    qualityTermUrl: "",
    surveyCloseUrl: "",
    about: "",
    allowedCountries: [] as string[], // ISO-2 codes
    api: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | undefined>(undefined);

  const update = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const COUNTRY_OPTS = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  // add/remove allowed countries
  const [pendingCountry, setPendingCountry] = useState("");
  const addAllowed = () => {
    if (!pendingCountry) return;
    if (form.allowedCountries.includes(pendingCountry)) return;
    update("allowedCountries", [...form.allowedCountries, pendingCountry]);
    setPendingCountry("");
  };
  const removeAllowed = (code: string) =>
    update(
      "allowedCountries",
      form.allowedCountries.filter((c) => c !== code)
    );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // build payload expected by API/Prisma
      const payload = {
        name: form.supplierName.trim(),
        website: form.website.trim() || null,
        countryCode: form.country,
        email: form.email.trim() || null,
        contactNumber: form.contactNumber.trim() || null,
        panelSize:
          form.panelSize === "" ? null : Math.max(0, parseInt(form.panelSize, 10) || 0),

        completeUrl: form.completeUrl.trim(),
        terminateUrl: form.terminateUrl.trim(),
        overQuotaUrl: form.overQuotaUrl.trim(),
        qualityTermUrl: form.qualityTermUrl.trim(),
        surveyCloseUrl: form.surveyCloseUrl.trim(),

        about: form.about.trim() || null,
        allowedCountries: form.allowedCountries,
        api: !!form.api,
      };

      const res = await fetch("/api/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to create supplier (HTTP ${res.status})`);
      }

      const created = await res.json(); // should include { id, code, ... }
      setCreatedCode(created?.code);
      setSuccessOpen(true);
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to create supplier"));
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    // go to Supplier List (adjust path to your list page)
    router.replace("/supplier/new/supplierlist");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add Supplier</h1>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.api}
            onChange={(e) => update("api", e.target.checked)}
          />
          API
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Top 3-column rows */}
        <div className="grid grid-cols-12 gap-6">
          <Field>
            <Label required>Supplier Name</Label>
            <Input
              value={form.supplierName}
              onChange={(e) => update("supplierName", e.target.value)}
              required
              autoComplete="organization"
            />
          </Field>

          <Field>
            <Label required>Supplier Website</Label>
            <Input
              type="url"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              required
              placeholder="https://example.com"
              inputMode="url"
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
              autoComplete="email"
            />
          </Field>

          <Field>
            <Label>Contact Number</Label>
            <Input
              type="tel"
              value={form.contactNumber}
              onChange={(e) => update("contactNumber", e.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
          </Field>

          <Field>
            <Label>Panel Size</Label>
            <Input
              type="number"
              min={0}
              value={form.panelSize}
              onChange={(e) => update("panelSize", e.target.value)}
            />
          </Field>

          {/* URLs row 1 */}
          <Field>
            <Label required>Complete</Label>
            <Input
              type="url"
              value={form.completeUrl}
              onChange={(e) => update("completeUrl", e.target.value)}
              required
              inputMode="url"
              placeholder="https://..."
            />
            <CopyableHint example="https://opinion-elite.com/Thanks/Verify?auth=c&rid=[identifier]" />
          </Field>

          <Field>
            <Label required>Terminate</Label>
            <Input
              type="url"
              value={form.terminateUrl}
              onChange={(e) => update("terminateUrl", e.target.value)}
              required
              inputMode="url"
              placeholder="https://..."
            />
            <CopyableHint example="https://opinion-elite.com/Thanks/Verify?auth=t&rid=[identifier]" />
          </Field>

          <Field>
            <Label required>Over Quota</Label>
            <Input
              type="url"
              value={form.overQuotaUrl}
              onChange={(e) => update("overQuotaUrl", e.target.value)}
              required
              inputMode="url"
              placeholder="https://..."
            />
            <CopyableHint example="https://opinion-elite.com/Thanks/Verify?auth=q&rid=[identifier]" />
          </Field>

          {/* URLs row 2 */}
          <Field>
            <Label required>Quality Term</Label>
            <Input
              type="url"
              value={form.qualityTermUrl}
              onChange={(e) => update("qualityTermUrl", e.target.value)}
              required
              inputMode="url"
              placeholder="https://..."
            />
            <CopyableHint example="https://opinion-elite.com/Thanks/Verify?auth=f&rid=[identifier]" />
          </Field>

          <Field>
            <Label required>Survey Close</Label>
            <Input
              type="url"
              value={form.surveyCloseUrl}
              onChange={(e) => update("surveyCloseUrl", e.target.value)}
              required
              inputMode="url"
              placeholder="https://..."
            />
            <CopyableHint example="https://opinion-elite.com/Thanks/Verify?auth=sc&rid=[identifier]" />
          </Field>

          {/* spacer to align grid */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4" />

          {/* About supplier (full width) */}
          <div className="col-span-12">
            <Label>About Supplier</Label>
            <Textarea
              rows={5}
              value={form.about}
              onChange={(e) => update("about", e.target.value)}
              placeholder="Company background, specialties, notes…"
            />
          </div>
        </div>

        {/* Allowed Countries dual list */}
        <div className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-6">
            <Label required>Allowed Countries</Label>
            <div className="flex items-center gap-2">
              <Select
                value={pendingCountry}
                onChange={(e) => setPendingCountry(e.target.value)}
                className="w-80"
              >
                <option value="">Select</option>
                {COUNTRY_OPTS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={addAllowed}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                title="Add"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div className="col-span-12 xl:col-span-6">
            <Label>Selected Countries</Label>
            {form.allowedCountries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                None selected.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.allowedCountries.map((code) => {
                  const name = COUNTRY_OPTS.find((c) => c.code === code)?.name ?? code;
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeAllowed(code)}
                        className="rounded p-0.5 hover:bg-white"
                        title="Remove"
                        aria-label={`Remove ${name}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <SuccessModal open={successOpen} code={createdCode} onClose={handleSuccessClose} />
    </div>
  );
}