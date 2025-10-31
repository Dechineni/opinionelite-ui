export const runtime = 'edge';

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { COUNTRIES, getLanguagesForCountry } from "@/data/countries";
import { useClientsLite } from "@/hooks/useClientsLite";
import { useRouter } from "next/navigation";

/* ---------- tiny UI helpers ---------- */
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

/* ---------- helpers ---------- */
const toNum = (v: string) =>
  v === "" || v === undefined || v === null ? undefined : Number(v);
const toISO = (v: string) => (v ? new Date(v).toISOString() : undefined);

/* ---------- success dialog ---------- */
function SuccessDialog({
  open,
  onClose,
  message = "Project Created Successfully",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40">
      <div className="w-[420px] max-w-[90vw] rounded-xl bg-white p-6 shadow-2xl">
        <p className="text-center text-lg font-semibold text-slate-800">
          {message}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="min-w-[90px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GroupProjectForm() {
  // Load clients for dropdown
  const { clients, loading: clientsLoading, error: clientsError } =
    useClientsLite();

  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const [form, setForm] = useState({
    // group-level
    client: "",
    groupName: "",
    groupDescription: "",
    groupDynamicThanks: false,

    // child project
    childName: "",
    childManager: "",
    childCategory: "",
    currency: "USD",
    country: "",
    language: "",
    childDescription: "",

    // metrics
    loi: "",
    ir: "",
    sampleSize: "0",
    clickQuota: "0",
    projectCpi: "",
    supplierCpi: "",
    startDate: "",
    endDate: "",

    // filters
    preScreen: false,
    exclude: false,
    geoLocation: false,
    dynamicThanksUrl: false,
    uniqueIp: false,
    uniqueIpDepth: 1,
    tSign: false,
    speeder: false,
    speederDepth: 1,

    // device
    mobile: true,
    tablet: false,
    desktop: false,

    notes: "",
  });
  const update = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  // country & language linkage
  const COUNTRY_OPTS = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const LANGUAGE_OPTS = useMemo(
    () => getLanguagesForCountry(form.country),
    [form.country]
  );
  useEffect(() => {
    if (!form.language) return;
    const stillValid = LANGUAGE_OPTS.some((l) => l.code === form.language);
    if (!stillValid) update("language", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country, LANGUAGE_OPTS.length]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = {
        clientId: form.client,
        name: form.groupName || "(Group)",
        description: form.groupDescription || null,
        dynamicThanks: form.groupDynamicThanks,

        project: {
          name: form.childName,
          manager: form.childManager,              // can be name or email
          category: form.childCategory,
          description: form.childDescription || null,

          country: form.country,
          language: form.language,
          currency: form.currency || "USD",

          loi: toNum(form.loi),
          ir: toNum(form.ir),
          sampleSize: toNum(form.sampleSize),
          clickQuota: toNum(form.clickQuota),

          projectCpi: form.projectCpi === "" ? undefined : form.projectCpi,
          supplierCpi: form.supplierCpi === "" ? null : form.supplierCpi,

          startDate: toISO(form.startDate),
          endDate: toISO(form.endDate),

          preScreen: form.preScreen,
          exclude: form.exclude,
          geoLocation: form.geoLocation,
          dynamicThanks: form.dynamicThanksUrl,
          dynamicThanksUrl: form.dynamicThanksUrl,
          uniqueIp: form.uniqueIp,
          uniqueIpDepth:
            form.uniqueIp && form.uniqueIpDepth
              ? Number(form.uniqueIpDepth)
              : null,
          tSign: form.tSign,
          speeder: form.speeder,
          speederDepth:
            form.speeder && form.speederDepth
              ? Number(form.speederDepth)
              : null,

          mobile: form.mobile,
          tablet: form.tablet,
          desktop: form.desktop,
        },
      };

      const res = await fetch("/api/project-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json(); // { group, project }
      setCreatedId(payload?.project?.id || payload?.firstProject?.id || null);

      // Show success dialog
      setSuccessOpen(true);
    } catch (err: any) {
      setError(err?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header with right-side Dynamic Thanks */}
        <div className="flex items-center justify-between rounded-t-xl bg-slate-100 px-4 py-2">
          <div className="text-sm font-semibold text-slate-700">Group Project</div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.groupDynamicThanks}
              onChange={(e) => update("groupDynamicThanks", e.target.checked)}
            />
            Dynamic Thanks
          </label>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate            // <-- disable native email validation
          className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          {/* Top row: client, group name, group description */}
          <div className="grid grid-cols-12 gap-4">
            <Field>
              <Label required>Client</Label>
              <Select
                value={form.client}
                onChange={(e) => update("client", e.target.value)}
                required
              >
                <option value="">
                  {clientsLoading ? "Loading..." : "-- Select Client --"}
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {clientsError && (
                <p className="mt-1 text-xs text-rose-600">{clientsError}</p>
              )}
            </Field>

            <Field>
              <Label>Group Name (optional)</Label>
              <Input
                value={form.groupName}
                onChange={(e) => update("groupName", e.target.value)}
                placeholder="Enter group name"
              />
            </Field>

            <Field>
              <Label>Group Description</Label>
              <Input
                value={form.groupDescription}
                onChange={(e) => update("groupDescription", e.target.value)}
                placeholder="Short description"
              />
            </Field>
          </div>

          {/* Child section header */}
          <div className="mt-6 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
            Child Project Details
          </div>

          {/* Child rows */}
          <div className="mt-3 grid grid-cols-12 gap-4">
            <div className="col-span-12 xl:col-span-3">
              <Label required>Project Name</Label>
              <Input
                value={form.childName}
                onChange={(e) => update("childName", e.target.value)}
                required
              />
            </div>
            <div className="col-span-12 xl:col-span-3">
              <Label required>Project Manager</Label>
              <Input
                // was: type="email" — allow names or emails
                type="text"
                value={form.childManager}
                onChange={(e) => update("childManager", e.target.value)}
                placeholder="e.g. DemoManager or manager@company.com"
                required
              />
            </div>
            <div className="col-span-12 xl:col-span-3">
              <Label required>Project Category</Label>
              <Select
                value={form.childCategory}
                onChange={(e) => update("childCategory", e.target.value)}
                required
              >
                <option value="">-- Select Category --</option>
                <option>Adhoc</option>
                <option>Tracker</option>
                <option>Segmentation</option>
              </Select>
            </div>
            <div className="col-span-12 xl:col-span-3">
              <Label required>Currency</Label>
              <Select
                value={form.currency}
                onChange={(e) => update("currency", e.target.value)}
                required
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>INR</option>
              </Select>
            </div>

            {/* Country / Language */}
            <div className="col-span-12 md:col-span-6">
              <Label required>Project Country</Label>
              <Select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                required
              >
                <option value="">-- Select --</option>
                {COUNTRY_OPTS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label required>Project Language</Label>
              <Select
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
                required
                disabled={!form.country}
                title={!form.country ? "Select country first" : undefined}
              >
                <option value="">
                  {form.country
                    ? "-- Select Language --"
                    : "Select country first"}
                </option>
                {getLanguagesForCountry(form.country).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Child description */}
            <div className="col-span-12">
              <Label>Project Description</Label>
              <Textarea
                rows={3}
                value={form.childDescription}
                onChange={(e) => update("childDescription", e.target.value)}
                placeholder="Type description"
              />
            </div>

            {/* Metrics */}
            <div className="col-span-12 grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-6 xl:col-span-3">
                <Label required>LOI (Minute)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.loi}
                  onChange={(e) => update("loi", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-12 md:col-span-6 xl:col-span-3">
                <Label required>IR (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.ir}
                  onChange={(e) => update("ir", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-12 md:col-span-6 xl:col-span-3">
                <Label required>Sample Size</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sampleSize}
                  onChange={(e) => update("sampleSize", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-12 md:col-span-6 xl:col-span-3">
                <Label required>Respondent Click Quota</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.clickQuota}
                  onChange={(e) => update("clickQuota", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* CPI / Dates */}
            <div className="col-span-12 grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                <Label required>Project CPI</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.projectCpi}
                  onChange={(e) => update("projectCpi", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                <Label>Supplier CPI</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.supplierCpi}
                  onChange={(e) => update("supplierCpi", e.target.value)}
                />
              </div>
              <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                <Label required>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  required
                />
              </div>
              <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                <Label required>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Project Filter */}
          <div className="mt-6">
            <div className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
              Project Filter
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.preScreen}
                  onChange={(e) => update("preScreen", e.target.checked)}
                />{" "}
                PreScreen
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.geoLocation}
                  onChange={(e) => update("geoLocation", e.target.checked)}
                />{" "}
                Geo Location
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.uniqueIp}
                  onChange={(e) => update("uniqueIp", e.target.checked)}
                />{" "}
                Unique IP
                <input
                  type="number"
                  min={1}
                  className="ml-2 w-14 rounded border border-slate-200 px-2 py-1 text-xs"
                  value={form.uniqueIpDepth}
                  onChange={(e) => update("uniqueIpDepth", Number(e.target.value))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.exclude}
                  onChange={(e) => update("exclude", e.target.checked)}
                />{" "}
                Exclude
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.dynamicThanksUrl}
                  onChange={(e) => update("dynamicThanksUrl", e.target.checked)}
                />{" "}
                Dynamic Thanks Url
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.tSign}
                  onChange={(e) => update("tSign", e.target.checked)}
                />{" "}
                TSign
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.speeder}
                  onChange={(e) => update("speeder", e.target.checked)}
                />{" "}
                Speeder
                <input
                  type="number"
                  min={1}
                  className="ml-2 w-14 rounded border border-slate-200 px-2 py-1 text-xs"
                  value={form.speederDepth}
                  onChange={(e) => update("speederDepth", Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          {/* Device Filter */}
          <div className="mt-6">
            <div className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
              Device Filter
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.mobile}
                  onChange={(e) => update("mobile", e.target.checked)}
                />{" "}
                Mobile Study
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.tablet}
                  onChange={(e) => update("tablet", e.target.checked)}
                />{" "}
                Tablet Study
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.desktop}
                  onChange={(e) => update("desktop", e.target.checked)}
                />{" "}
                Desktop Study
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <Label>Notes</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Type notes (max 2000 chars)"
            />
            <div className="mt-1 text-xs text-slate-500">
              Maximum limit of characters 2000
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => history.back()}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>

      {/* success pop-up */}
      <SuccessDialog
        open={successOpen}
        onClose={() => {
          setSuccessOpen(false);
          if (createdId) router.push(`/projects/projectdetail?id=${createdId}`);
        }}
        message="Project Created Successfully"
      />
    </>
  );
}