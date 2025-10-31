// FILE: src/app/(app)/supplier/EditSupplier.tsx
"use client";
export const runtime = 'edge';

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/data/countries";
import { Plus, X } from "lucide-react";

/* ----------------------------- tiny UI helpers ----------------------------- */
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

function CopyableHint({ example }: { example: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
    } catch {}
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

/* ---------------------------------- page ---------------------------------- */
export default function EditSupplier({ supplierId }: { supplierId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    allowedCountries: [] as string[],
    api: false,
    code: "", // display only
  });

  const update = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  // Always provide a safe array to map over
  const COUNTRY_OPTS = useMemo(() => {
    const list = Array.isArray(COUNTRIES) ? COUNTRIES : [];
    return [...list]
      .filter((c: any) => c && typeof c === "object")
      .sort((a: any, b: any) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
  }, []);

  // add/remove allowed countries
  const [pendingCountry, setPendingCountry] = useState("");
  const addAllowed = () => {
    if (!pendingCountry) return;
    if ((form.allowedCountries || []).includes(pendingCountry)) return;
    update("allowedCountries", [...(form.allowedCountries || []), pendingCountry]);
    setPendingCountry("");
  };
  const removeAllowed = (code: string) =>
    update(
      "allowedCountries",
      (form.allowedCountries || []).filter((c) => c !== code)
    );

  // load data
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!supplierId) {
          setErr("Missing supplier id");
          setLoading(false);
          return;
        }
        setLoading(true);
        const r = await fetch(`/api/supplier/${encodeURIComponent(supplierId)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const s: any = await r.json();
        if (cancel) return;

        const website = s.website ?? s.site ?? s.url ?? "";
        const country = s.countryCode ?? s.country ?? s.country_code ?? "";
        const email = s.email ?? s.emailId ?? s.email_id ?? "";
        const contactNumber =
          s.contactNumber ?? s.contactNo ?? s.phone ?? s.phoneNumber ?? s.phone_number ?? "";
        const panelSize = s.panelSize ?? s.panel_size ?? null;

        setForm({
          supplierName: s.name ?? s.supplierName ?? "",
          website,
          country,
          email,
          contactNumber,
          panelSize: panelSize == null ? "" : String(panelSize),
          completeUrl: s.completeUrl ?? "",
          terminateUrl: s.terminateUrl ?? "",
          overQuotaUrl: s.overQuotaUrl ?? "",
          qualityTermUrl: s.qualityTermUrl ?? "",
          surveyCloseUrl: s.surveyCloseUrl ?? "",
          about: s.about ?? s.description ?? "",
          allowedCountries: Array.isArray(s.allowedCountries) ? s.allowedCountries : [],
          api: !!(s.api ?? s.isApi ?? s.apiEnabled),
          code: s.code ?? "",
        });
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load supplier");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [supplierId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setErr(null);
      const body = {
        name: form.supplierName,
        website: form.website || null,
        countryCode: form.country || null,
        email: form.email || null,
        contactNumber: form.contactNumber || null,
        panelSize: form.panelSize ? Number(form.panelSize) : null,
        completeUrl: form.completeUrl,
        terminateUrl: form.terminateUrl,
        overQuotaUrl: form.overQuotaUrl,
        qualityTermUrl: form.qualityTermUrl,
        surveyCloseUrl: form.surveyCloseUrl,
        about: form.about || null,
        allowedCountries: Array.isArray(form.allowedCountries) ? form.allowedCountries : [],
        api: !!form.api,
      };
      const r = await fetch(`/api/supplier/${encodeURIComponent(supplierId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      alert("Supplier updated successfully!");
      router.push("/supplier/new/supplierlist");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Loading supplier…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Edit Supplier <span className="text-slate-500">({form.code})</span>
        </h1>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.api}
            onChange={(e) => update("api", e.target.checked)}
          />
          API
        </label>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {String(err)}
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-12 gap-6">
          <Field>
            <Label required>Supplier Name</Label>
            <Input
              value={form.supplierName}
              onChange={(e) => update("supplierName", e.target.value)}
              required
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
              {COUNTRY_OPTS.length === 0 ? (
                <option value="" disabled>
                  (No countries loaded)
                </option>
              ) : (
                COUNTRY_OPTS.map((c: any) => (
                  <option key={String(c.code)} value={String(c.code)}>
                    {String(c.name)}
                  </option>
                ))
              )}
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

          {/* spacer */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4" />

          {/* About */}
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
            <Label>Allowed Countries</Label>
            <div className="flex items-center gap-2">
              <Select
                value={pendingCountry}
                onChange={(e) => setPendingCountry(e.target.value)}
                className="w-80"
              >
                <option value="">Select</option>
                {COUNTRY_OPTS.map((c: any) => (
                  <option key={String(c.code)} value={String(c.code)}>
                    {String(c.name)}
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
            {Array.isArray(form.allowedCountries) && form.allowedCountries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.allowedCountries.map((code) => {
                  const name =
                    COUNTRY_OPTS.find((c: any) => String(c.code) === String(code))?.name ?? code;
                  return (
                    <span
                      key={String(code)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm"
                    >
                      {String(name)}
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
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                None selected.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
