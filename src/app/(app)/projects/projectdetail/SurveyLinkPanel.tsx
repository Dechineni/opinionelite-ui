// src/app/(app)/projects/projectdetail/SurveyLinkPanel.tsx

export const runtime = 'edge';

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Copy, RotateCcw, Edit3, Save } from "lucide-react";

type Props = { projectId: string };

type SurveyData = {
  type: "single" | "multi";
  liveUrl: string;
  testUrl: string;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 text-sm font-semibold text-slate-800">{children}</div>
);
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={[
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

export default function SurveyLinkPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // server values
  const [data, setData] = useState<SurveyData>({
    type: "single",
    liveUrl: "",
    testUrl: "",
  });

  // local form (for edit mode)
  const [form, setForm] = useState<SurveyData>(data);
  const update = (k: keyof SurveyData, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  // mode
  const [editMode, setEditMode] = useState(false);

  // load on mount
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/projects/${projectId}/survey-links`, {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(await r.text());
        const d = (await r.json()) as SurveyData;
        setData(d);
        setForm(d);
        // default to view mode if we already have a liveUrl saved
        setEditMode(!(d.liveUrl && d.liveUrl.length > 0));
      } catch (e: any) {
        setErr(e?.message || "Failed to load survey links");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [projectId]);

  const canSave = useMemo(
    () => !!form.liveUrl && form.liveUrl.trim().length > 0,
    [form.liveUrl]
  );

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/survey-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as SurveyData;
      setData(d);
      setForm(d);
      setEditMode(false);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-600">Loading…</div>
      </div>
    );
  }

  if (editMode) {
    // ---------------------- EDIT MODE ----------------------
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-800">Project Link Type</div>
          <button
            onClick={() => {
              setForm(data); // reset edits
              setEditMode(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Cancel edit"
          >
            <RotateCcw size={16} />
            Cancel
          </button>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              checked={form.type === "single"}
              onChange={() => update("type", "single")}
            />
            Single Link
          </label>
          <label className="mt-2 flex items-center gap-3 text-sm opacity-60">
            <input
              type="radio"
              checked={form.type === "multi"}
              onChange={() => update("type", "multi")}
              disabled
            />
            Multi Link (coming soon)
          </label>
        </div>

        <div className="grid gap-5">
          <div>
            <Label>Live*</Label>
            <Input
              placeholder="https://…"
              inputMode="url"
              value={form.liveUrl}
              onChange={(e) => update("liveUrl", e.target.value)}
              required
            />
            <div className="mt-1 text-xs text-slate-500">
              Link eg. https://opinion-elite.com/entry?rid=[identifier]
            </div>
          </div>

          <div>
            <Label>Test</Label>
            <Input
              placeholder="https://…"
              inputMode="url"
              value={form.testUrl}
              onChange={(e) => update("testUrl", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500">
              Link eg. https://opinion-elite.com/test?rid=[identifier]
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onSave}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------- VIEW MODE ----------------------
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-800">Project Link Type</div>

        {/* right side actions like screenshot */}
        <div className="flex items-center gap-2">
          {data.testUrl && (
            <a
              href={data.testUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              title="Open Test Survey"
            >
              Test Survey <ExternalLink size={16} />
            </a>
          )}
          <button
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Edit survey links"
          >
            <Edit3 size={16} />
            Edit
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-3 text-sm">
          <input type="radio" checked={true} readOnly />
          Single Link
        </label>
      </div>

      {/* Live row */}
      <Row
        label="Live*"
        url={data.liveUrl}
        onCopy={() => copy(data.liveUrl)}
      />
      {/* Test row */}
      <Row
        label="Test"
        url={data.testUrl}
        onCopy={() => copy(data.testUrl)}
      />
    </div>
  );
}

function Row({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: () => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-[64px_1fr] items-start gap-4">
      <div className="pt-1 text-sm font-semibold text-slate-800">{label}</div>
      <div className="text-[15px] leading-6 text-slate-800">
        {url ? (
          <div className="flex items-start gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="break-all underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
            >
              {url}
            </a>
            <button
              onClick={onCopy}
              className="mt-0.5 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              title="Copy link"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}