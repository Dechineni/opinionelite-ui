// FILE: src/app/(app)/projects/projectdetail/SupplierMappingPanel.tsx
"use client";
export const runtime = 'edge';

import React, { useEffect, useMemo, useState } from "react";

type SupplierLite = { id: string; code: string; name: string };

type RedirectionType =
  | "STATIC_REDIRECT"
  | "STATIC_POSTBACK"
  | "DYNAMIC_REDIRECT"
  | "DYNAMIC_POSTBACK";

type MapRow = {
  id: string;
  supplierId: string;

  // flattened for display (derived from include: { supplier: ... })
  supplierCode?: string;
  supplierName?: string;

  // server fields
  quota: number; // DB column for supplier quota
  clickQuota: number; // kept in type, but hidden in UI
  cpi: string; // Decimal as string from server
  redirectionType: RedirectionType;

  // Redirect URLs (stored for *REDIRECT variants)
  completeUrl?: string | null;
  terminateUrl?: string | null;
  overQuotaUrl?: string | null;
  qualityTermUrl?: string | null;
  surveyCloseUrl?: string | null;

  // Extras
  allowTraffic: boolean;
  supplierProjectId?: string | null;

  // present in GET include; used only to flatten
  supplier?: { id: string; code: string; name: string } | null;
};

const REDIRECT_LABELS: { value: RedirectionType; label: string }[] = [
  { value: "STATIC_REDIRECT", label: "Static Redirect" },
  { value: "STATIC_POSTBACK", label: "Static PostBack" },
  { value: "DYNAMIC_REDIRECT", label: "Dynamic Redirect" },
  { value: "DYNAMIC_POSTBACK", label: "Dynamic PostBack" },
];

const isRedirect = (t: RedirectionType) =>
  t === "STATIC_REDIRECT" || t === "DYNAMIC_REDIRECT";
const isStaticRedirect = (t: RedirectionType) => t === "STATIC_REDIRECT";

export default function SupplierMappingPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MapRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  // project code for SupplierUrl
  const [projectCode, setProjectCode] = useState<string>(projectId);

  // accordion + edit state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // duplicate warning modal
  const [dupOpen, setDupOpen] = useState(false);

  // form state (clickQuota removed from UI)
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: "",
    supplierQuota: "",
    cpi: "",
    redirectionType: "STATIC_REDIRECT" as RedirectionType,

    // redirect URLs (required for *REDIRECT types)
    completeUrl: "",
    terminateUrl: "",
    overQuotaUrl: "",
    qualityTermUrl: "",
    surveyCloseUrl: "",

    // optional (kept for future)
    allowTraffic: false,
    supplierProjectId: "",
    testLink: "",
  });

  const update = (k: keyof typeof form, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  // helper to flatten rows from API
  function normalizeRows(input: any): MapRow[] {
    const list = Array.isArray(input) ? input : input?.items;
    if (!Array.isArray(list)) return [];
    return list.map((r: any) => ({
      ...r,
      supplierCode: r.supplier?.code ?? r.supplierCode ?? "",
      supplierName: r.supplier?.name ?? r.supplierName ?? "",
      quota: r.quota ?? 0,
    }));
  }

  /** Resolve the UI origin for building SupplierUrl:
   * 1) use NEXT_PUBLIC_UI_ORIGIN if provided
   * 2) otherwise use current window.origin (dev/local)
   * 3) final fallback to http://localhost:3000 (very edge)
   */
  function getUiOrigin() {
    const envOrigin = process.env.NEXT_PUBLIC_UI_ORIGIN?.trim();
    if (envOrigin) return envOrigin.replace(/\/+$/, "");
    if (typeof window !== "undefined" && window.location?.origin)
      return window.location.origin;
    return "http://localhost:3000";
  }

  // Build Supplier URL using projectCode and supplierCode from DB
  function buildSupplierUrl(projectCodeVal: string | undefined, supplierCodeVal: string | undefined) {
    const p = encodeURIComponent(projectCodeVal || "");
    const s = encodeURIComponent(supplierCodeVal || "");
    if (!p || !s) return "—";
    const uiOrigin = getUiOrigin();
    return `${uiOrigin}/Survey?projectId=${p}&supplierId=${s}&id=[identifier]`;
  }

  async function reloadMaps() {
    const res = await fetch(`/api/projects/${projectId}/supplier-maps`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const raw = await res.json();
    setRows(normalizeRows(raw));
  }

  // fetch suppliers + maps + project (for project code)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sRes, mRes, pRes] = await Promise.all([
          fetch("/api/supplier/lite", { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/supplier-maps`, { cache: "no-store" }),
          // Try to get project (for its 'code'); fallback to projectId if this route doesn't exist
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }).catch(() => null as any),
        ]);

        if (!sRes.ok) throw new Error(await sRes.text());
        if (!mRes.ok) throw new Error(await mRes.text());

        const supJson = await sRes.json();
        const supArr = Array.isArray(supJson) ? supJson : supJson?.items ?? [];

        const mapsJson = await mRes.json();
        const mapped = normalizeRows(mapsJson);

        let projCode = projectId; // default fallback
        if (pRes && pRes.ok) {
          const pj = await pRes.json();
          const c = (pj?.code ?? pj?.data?.code ?? pj?.project?.code) as string | undefined;
          if (c) projCode = c;
        }

        if (!cancelled) {
          setProjectCode(String(projCode));
          setSuppliers(supArr as SupplierLite[]);
          setRows(mapped);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // when supplier changes, fetch its URLs and prefill
  useEffect(() => {
    let cancelled = false;
    async function fetchSupplierUrls(id: string) {
      try {
        if (!id) return;
        const res = await fetch(`/api/supplier/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const sup = await res.json();

        const {
          completeUrl = "",
          terminateUrl = "",
          overQuotaUrl = "",
          qualityTermUrl = "",
          surveyCloseUrl = "",
        } = sup || {};

        if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            completeUrl: String(completeUrl || ""),
            terminateUrl: String(terminateUrl || ""),
            overQuotaUrl: String(overQuotaUrl || ""),
            qualityTermUrl: String(qualityTermUrl || ""),
            surveyCloseUrl: String(surveyCloseUrl || ""),
          }));
        }
      } catch {
        // ignore; keep fields as-is
      }
    }

    if (form.supplierId) fetchSupplierUrls(form.supplierId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.supplierId]);

  const supplierOptions = useMemo(
    () =>
      (Array.isArray(suppliers) ? suppliers : [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ ...s, label: `${s.code} — ${s.name}` })),
    [suppliers]
  );

  // set of already mapped supplier IDs
  const mappedSupplierIds = useMemo(
    () => new Set(rows.map((r) => r.supplierId)),
    [rows]
  );

  // handle selection with duplicate check (only when adding)
  function handleSupplierSelect(value: string) {
    if (!editingId && value && mappedSupplierIds.has(value)) {
      setDupOpen(true);
      update("supplierId", "");
      return;
    }
    update("supplierId", value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        supplierId: form.supplierId,
        supplierQuota: form.supplierQuota === "" ? undefined : Number(form.supplierQuota),
        // Click quota hidden → send safe default on create, omit on edit
        clickQuota: editingId ? undefined : 0,
        cpi: Number(form.cpi || 0),
        redirectionType: form.redirectionType,
        allowTraffic: !!form.allowTraffic,
        supplierProjectId: form.supplierProjectId || null,
        testLink: form.testLink || null,
      };

      if (isRedirect(form.redirectionType)) {
        Object.assign(payload, {
          completeUrl: form.completeUrl || null,
          terminateUrl: form.terminateUrl || null,
          overQuotaUrl: form.overQuotaUrl || null,
          qualityTermUrl: form.qualityTermUrl || null,
          surveyCloseUrl: form.surveyCloseUrl || null,
        });
      }

      const url = editingId
        ? `/api/projects/${projectId}/supplier-maps/${editingId}`
        : `/api/projects/${projectId}/supplier-maps`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      await reloadMaps();

      // reset
      setEditingId(null);
      setForm({
        supplierId: "",
        supplierQuota: "",
        cpi: "",
        redirectionType: "STATIC_REDIRECT",
        completeUrl: "",
        terminateUrl: "",
        overQuotaUrl: "",
        qualityTermUrl: "",
        surveyCloseUrl: "",
        allowTraffic: false,
        supplierProjectId: "",
        testLink: "",
      });
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Prefill & open form in edit mode (no clickQuota field to prefill)
  function startEdit(r: MapRow) {
    setForm({
      supplierId: r.supplierId,
      supplierQuota: String(r.quota ?? ""),
      cpi: String(r.cpi ?? ""),
      redirectionType: r.redirectionType,
      completeUrl: String(r.completeUrl ?? ""),
      terminateUrl: String(r.terminateUrl ?? ""),
      overQuotaUrl: String(r.overQuotaUrl ?? ""),
      qualityTermUrl: String(r.qualityTermUrl ?? ""),
      surveyCloseUrl: String(r.surveyCloseUrl ?? ""),
      allowTraffic: !!r.allowTraffic,
      supplierProjectId: String(r.supplierProjectId ?? ""),
      testLink: "",
    });
    setEditingId(r.id);
    setOpen(true);
  }

  function cancelForm() {
    setEditingId(null);
    setOpen(false);
    setForm({
      supplierId: "",
      supplierQuota: "",
      cpi: "",
      redirectionType: "STATIC_REDIRECT",
      completeUrl: "",
      terminateUrl: "",
      overQuotaUrl: "",
      qualityTermUrl: "",
      surveyCloseUrl: "",
      allowTraffic: false,
      supplierProjectId: "",
      testLink: "",
    });
    setError(null);
  }

  // SupplierUrl column
  function SupplierUrlCell(r: MapRow) {
    const url = buildSupplierUrl(projectCode, r.supplierCode);
    if (url === "—") return <span>—</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 hover:underline break-all"
        title={url}
      >
        {url}
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* table header */}
      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2">S.No.</th>
              <th className="px-3 py-2">SupplierCode</th>
              <th className="px-3 py-2">SupplierName</th>
              <th className="px-3 py-2">Quota</th>
              {/* ClickQuota column removed */}
              <th className="px-3 py-2">CPI</th>
              <th className="px-3 py-2">SupplierProjectId</th>
              <th className="px-3 py-2">SupplierUrl</th>
              <th className="px-3 py-2">TestLink</th>
              <th className="px-3 py-2">AllowTraffic</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                  No Supplier Mapped
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{r.supplierCode || "—"}</td>
                  <td className="px-3 py-2">{r.supplierName || "—"}</td>
                  <td className="px-3 py-2">{r.quota ?? 0}</td>
                  {/* clickQuota hidden */}
                  <td className="px-3 py-2">{r.cpi}</td>
                  <td className="px-3 py-2">{r.supplierProjectId ?? "—"}</td>
                  <td className="px-3 py-2">
                    <SupplierUrlCell {...r} />
                  </td>
                  <td className="px-3 py-2">—</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!r.allowTraffic}
                      onChange={async (e) => {
                        const allowTraffic = e.target.checked;
                        try {
                          const res = await fetch(
                            `/api/projects/${projectId}/supplier-maps/${r.id}`,
                            {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ allowTraffic }),
                            }
                          );
                          if (!res.ok) throw new Error(await res.text());
                          setRows((list) =>
                            list.map((x) =>
                              x.id === r.id ? { ...x, allowTraffic } : x
                            )
                          );
                        } catch (err: any) {
                          alert(err?.message || "Update failed");
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                      onClick={() => startEdit(r)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* accordion header */}
      <div className="mt-5 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          <span className="text-lg">{open ? "−" : "+"}</span>{" "}
          {editingId ? "Edit Supplier Map" : "Add Supplier"}
        </button>
      </div>

      {/* form */}
      {open && (
        <form onSubmit={onSubmit} noValidate className="mt-3 grid grid-cols-12 gap-4">
          {/* Supplier + SupplierQuota */}
          <div className="col-span-12 md:col-span-6">
            <label className="mb-1 block text-xs font-medium">Supplier*</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.supplierId}
              onChange={(e) => handleSupplierSelect(e.target.value)}
              required
              disabled={!!editingId}
              title={editingId ? "Supplier cannot be changed while editing" : undefined}
            >
              <option value="">-- Select Supplier --</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="mb-1 block text-xs font-medium">Supplier Quota*</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.supplierQuota}
              onChange={(e) => update("supplierQuota", e.target.value)}
              required
            />
          </div>

          {/* CPI (Click Quota field removed) */}
          <div className="col-span-12 md:col-span-6">
            <label className="mb-1 block text-xs font-medium">CPI*</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.cpi}
              onChange={(e) => update("cpi", e.target.value)}
              required
            />
          </div>

          {/* Redirection Type */}
          <div className="col-span-12 md:col-span-6">
            <label className="mb-1 block text-xs font-medium">Redirection Type*</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.redirectionType}
              onChange={(e) => update("redirectionType", e.target.value as RedirectionType)}
              required
            >
              {REDIRECT_LABELS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Redirect: 5 URLs (for BOTH Static Redirect and Dynamic Redirect) */}
          {isRedirect(form.redirectionType) && (
            <>
              {(
                [
                  ["Complete*", "completeUrl", "https://.../Thanks/Verify?auth=c&rid=[identifier]"],
                  ["Terminate*", "terminateUrl", "https://.../Thanks/Verify?auth=t&rid=[identifier]"],
                  ["Over Quota*", "overQuotaUrl", "https://.../Thanks/Verify?auth=q&rid=[identifier]"],
                  ["Quality Term*", "qualityTermUrl", "https://.../Thanks/Verify?auth=f&rid=[identifier]"],
                  ["Survey Close*", "surveyCloseUrl", "https://.../Thanks/Verify?auth=sc&rid=[identifier]"],
                ] as const
              ).map(([label, key, ph]) => (
                <div key={key} className="col-span-12">
                  <label className="mb-1 block text-xs font-medium">{label}</label>
                  <input
                    type="url"
                    required
                    placeholder={ph}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={(form as any)[key]}
                    onChange={(e) => update(key as any, e.target.value)}
                    disabled={isStaticRedirect(form.redirectionType)}
                  />
                </div>
              ))}
            </>
          )}

          {error && (
            <div className="col-span-12 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="col-span-12 mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              onClick={cancelForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? (editingId ? "Updating…" : "Saving…") : editingId ? "Update" : "Submit"}
            </button>
          </div>
        </form>
      )}

      {/* Duplicate supplier modal */}
      {dupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[min(92vw,440px)] rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 text-center text-lg font-semibold">
              Supplier is already Mapped !
            </div>
            <div className="flex justify-center">
              <button
                className="rounded-md bg-teal-600 px-6 py-2 text-white hover:bg-teal-700"
                onClick={() => setDupOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}