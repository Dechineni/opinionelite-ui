// src/app/(app)/projects/edit/single/page.tsx
"use client";
export const runtime = 'edge';

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { COUNTRIES, getLanguagesForCountry } from "@/data/countries";
import { useClientsLite } from "@/hooks/useClientsLite";

/* ---------- helpers ---------- */
const toNum = (v: string) =>
  v === "" || v === undefined || v === null ? undefined : Number(v);
const toISO = (v: string) => (v ? new Date(v).toISOString() : undefined);
const fromISODateOnly = (d?: string) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

/* ---------- small UI ---------- */
const Label = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1 block text-xs font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-500">*</span>}
  </label>
);

function SuccessDialog({
  open,
  onClose,
  message = "Project Updated Successfully",
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

/* ---------- page ---------- */
export default function EditSingleProject() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const router = useRouter();

  // clients for dropdown
  const { clients, loading: clientsLoading, error: clientsError } = useClientsLite();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    projectName: "",
    managerEmail: "", // free text (name or email)
    category: "",
    description: "",

    country: "",
    language: "",
    currency: "USD",

    loi: "",
    ir: "",
    sampleSize: "",

    projectCpi: "",
    supplierCpi: "",

    startDate: "",
    endDate: "",

    preScreen: false,
    exclude: false,
    geoLocation: false,
    dynamicThanks: false,
    uniqueIp: false,
    uniqueIpDepth: "",
    tSign: false,
    speeder: false,
    speederDepth: "",

    mobile: true,
    tablet: false,
    desktop: false,
  });

  const update = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  // load project
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!id) {
          setErr("Missing project id");
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(await res.text());
        const p = await res.json();

        if (ignore) return;

        setForm({
          clientId: p.clientId ?? "",
          projectName: p.name ?? "",
          managerEmail: p.managerEmail ?? "",
          category: p.category ?? "",
          description: p.description ?? "",

          country: p.countryCode ?? "",
          language: p.languageCode ?? "",
          currency: p.currency ?? "USD",

          loi: String(p.loi ?? ""),
          ir: String(p.ir ?? ""),
          sampleSize: String(p.sampleSize ?? ""),

          projectCpi: p.projectCpi != null ? String(p.projectCpi) : "",
          supplierCpi: p.supplierCpi != null ? String(p.supplierCpi) : "",

          startDate: fromISODateOnly(p.startDate),
          endDate: fromISODateOnly(p.endDate),

          preScreen: !!p.preScreen,
          exclude: !!p.exclude,
          geoLocation: !!p.geoLocation,
          dynamicThanks: !!p.dynamicThanksUrl,
          uniqueIp: !!p.uniqueIp,
          uniqueIpDepth: p.uniqueIpDepth != null ? String(p.uniqueIpDepth) : "",

          tSign: !!p.tSign,
          speeder: !!p.speeder,
          speederDepth: p.speederDepth != null ? String(p.speederDepth) : "",

          mobile: !!p.mobile,
          tablet: !!p.tablet,
          desktop: !!p.desktop,
        });
      } catch (e: any) {
        setErr(e?.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  // country -> language options
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

    if (!id) return;

    setSaving(true);
    setErr(null);
    try {
      const body = {
        clientId: form.clientId,
        name: form.projectName,
        managerEmail: form.managerEmail,
        category: form.category,
        description: form.description || null,

        countryCode: form.country,
        languageCode: form.language,
        currency: form.currency || "USD",

        loi: toNum(form.loi),
        ir: toNum(form.ir),
        sampleSize: toNum(form.sampleSize),

        projectCpi: form.projectCpi === "" ? undefined : form.projectCpi,
        supplierCpi: form.supplierCpi === "" ? null : form.supplierCpi,

        startDate: toISO(form.startDate),
        endDate: toISO(form.endDate),

        preScreen: form.preScreen,
        exclude: form.exclude,
        geoLocation: form.geoLocation,
        dynamicThanksUrl: form.dynamicThanks,
        uniqueIp: form.uniqueIp,
        uniqueIpDepth: form.uniqueIpDepth === "" ? null : Number(form.uniqueIpDepth),
        tSign: form.tSign,
        speeder: form.speeder,
        speederDepth: form.speederDepth === "" ? null : Number(form.speederDepth),

        mobile: form.mobile,
        tablet: form.tablet,
        desktop: form.desktop,
      };

      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      setSuccessOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading…</div>;
  }

  return (
    <>
      {/* noValidate prevents browser email validation for manager field */}
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Edit Project</h1>
          <a
            href={`/projects/projectdetail?id=${encodeURIComponent(id)}`}
            className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* form card */}
        <div className="grid grid-cols-12 gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Client */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Client</Label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.clientId}
              onChange={(e) => update("clientId", e.target.value)}
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
            </select>
            {clientsError && (
              <p className="mt-1 text-xs text-rose-600">{clientsError}</p>
            )}
          </div>

          {/* Name / Manager / Category */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Project Name</Label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.projectName}
              onChange={(e) => update("projectName", e.target.value)}
              required
            />
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Project Manager</Label>
            <input
              // plain text (no browser email validation)
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.managerEmail}
              onChange={(e) => update("managerEmail", e.target.value)}
              placeholder="Manager name or email"
              required
            />
          </div>

          {/* Country / Language / Currency */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Project Country</Label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              required
            >
              <option value="">-- Select --</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label required>Project Language</Label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.language}
              onChange={(e) => update("language", e.target.value)}
              required
              disabled={!form.country}
            >
              <option value="">
                {form.country ? "-- Select Language --" : "Select country first"}
              </option>
              {LANGUAGE_OPTS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Label>Currency</Label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
            />
          </div>

          {/* Numbers */}
          <div className="col-span-12 md:col-span-3">
            <Label required>LOI (minutes)</Label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.loi}
              onChange={(e) => update("loi", e.target.value)}
              required
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <Label required>IR %</Label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.ir}
              onChange={(e) => update("ir", e.target.value)}
              required
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <Label required>Sample Size</Label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.sampleSize}
              onChange={(e) => update("sampleSize", e.target.value)}
              required
            />
          </div>
          {/* Click Quota field removed */}

          {/* CPI */}
          <div className="col-span-12 md:col-span-6">
            <Label required>Project CPI</Label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.projectCpi}
              onChange={(e) => update("projectCpi", e.target.value)}
              required
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label>Supplier CPI</Label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.supplierCpi}
              onChange={(e) => update("supplierCpi", e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="col-span-12 md:col-span-6">
            <Label required>Start Date</Label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.startDate}
              onChange={(e) => update("startDate", e.target.value)}
              required
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label required>End Date</Label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.endDate}
              onChange={(e) => update("endDate", e.target.value)}
              required
            />
          </div>

          {/* toggles */}
          <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                "preScreen",
                "exclude",
                "geoLocation",
                "dynamicThanks",
                "uniqueIp",
                "tSign",
                "speeder",
                "mobile",
                "tablet",
                "desktop",
              ] as const
            ).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(form as any)[k]}
                  onChange={(e) => update(k, e.target.checked)}
                />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>

          {/* depths */}
          <div className="col-span-12 md:col-span-6">
            <Label>Unique IP depth</Label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.uniqueIpDepth}
              onChange={(e) => update("uniqueIpDepth", e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label>Speeder depth</Label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.speederDepth}
              onChange={(e) => update("speederDepth", e.target.value)}
            />
          </div>

          {/* description */}
          <div className="col-span-12">
            <Label>Description</Label>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>

        {err && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-rose-700">
            {err}
          </div>
        )}
      </form>

      {/* success pop-up */}
      <SuccessDialog
        open={successOpen}
        onClose={() => {
          setSuccessOpen(false);
          router.push(`/projects/projectdetail?id=${encodeURIComponent(id)}`);
        }}
        message="Project Updated Successfully"
      />
    </>
  );
}