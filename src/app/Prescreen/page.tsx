// src/app/Prescreen/page.tsx
"use client";
export const runtime = "edge";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type ControlType = "TEXT" | "RADIO" | "DROPDOWN" | "CHECKBOX";         
type TextType = "EMAIL" | "CONTACTNO" | "ZIPCODE" | "CUSTOM";

type PrescreenOption = { id: string; label: string; value: string };
type PrescreenQuestion = {
  id: string;
  title: string;
  question: string;
  controlType: ControlType;
  textMinLength?: number | null;
  textMaxLength?: number | null;
  textType?: TextType | null;
  options?: PrescreenOption[];
};

function PrescreenInner() {
  const params = useSearchParams();

  const projectId = params.get("projectId") || "";
  const rid = params.get("identifier") || params.get("id") || "";
  const supplierId = params.get("supplierId") || "";
  const nextUrl = params.get("next") || "";

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<PrescreenQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const alertedOnce = useRef(false);

  // Global click logger (capture) — proves clicks hit the document
  useEffect(() => {
    const h = (e: MouseEvent) => {
      // comment out later — this is only for diagnosis
      console.log("[Prescreen] global click", (e.target as HTMLElement)?.tagName);
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, []);

  useEffect(() => {
    if (!projectId || !rid) {
      setError("Missing project or identifier.");
      setLoading(false);
    }
  }, [projectId, rid]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!projectId || !rid) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (supplierId) qs.set("supplierId", supplierId);
        const url = `/api/projects/${encodeURIComponent(
          projectId
        )}/prescreen/${encodeURIComponent(rid)}/pending${qs.toString() ? `?${qs.toString()}` : ""}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const items: PrescreenQuestion[] = Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json)
          ? json
          : [];

        if (!cancelled) setQuestions(items);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load prescreen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, rid, supplierId]);

  const canSubmit = useMemo(() => {
    if (questions.length === 0) return true;
    return questions.every((q) => {
      const v = answers[q.id];

      if (q.controlType === "TEXT") {
        if (typeof v !== "string" || !v.trim()) return false;
        const min = q.textMinLength ?? 0;
        const max = q.textMaxLength ?? 0;
        if (min && v.length < min) return false;
        if (max && max > 0 && v.length > max) return false;
        return true;
      }

      if (q.controlType === "CHECKBOX") {
        return Array.isArray(v) && v.length > 0;
      }

      return typeof v === "string" && v.length > 0;
    });
  }, [questions, answers]);

  function validateMissing(): string[] {
    const miss: string[] = [];
    for (const q of questions) {
      const v = answers[q.id];
      if (q.controlType === "TEXT") {
        const s = (v ?? "").toString().trim();
        const min = q.textMinLength ?? 0;
        const max = q.textMaxLength ?? 0;
        if (!s || (min && s.length < min) || (max && max > 0 && s.length > max)) {
          miss.push(q.question);
        }
      } else if (q.controlType === "CHECKBOX") {
        if (!Array.isArray(v) || v.length === 0) miss.push(q.question);
      } else {
        if (!v) miss.push(q.question);
      }
    }
    return miss;
  }

  function destinationAfterPrescreen(): string {
    if (nextUrl) return nextUrl;
    const u = new URL(
      `/api/projects/${encodeURIComponent(projectId)}/survey-live`,
      window.location.origin
    );
    if (supplierId) u.searchParams.set("supplierId", supplierId);
    u.searchParams.set("id", rid);
    return u.toString();
  }

  function buildAnswersPayload() {
    const flat = questions.map((q) => {
      const v = answers[q.id];
      return {
        questionId: q.id,
        value: q.controlType === "CHECKBOX" ? (Array.isArray(v) ? v : []) : String(v ?? ""),
      };
    });
    return {
      url: `/api/projects/${encodeURIComponent(
        projectId
      )}/prescreen/${encodeURIComponent(rid)}/answers`,
      body: { supplierId: supplierId || null, answers: flat },
    };
  }

  async function submitCore() {
    if (!projectId || !rid || submitting) return;

    // show *something* immediately to prove handler runs
    if (!alertedOnce.current) {
      alertedOnce.current = true;
      alert("Submitting…");
    }
    console.log("[Prescreen] onClick fired", {
      projectId,
      rid,
      supplierId,
      qCount: questions.length,
    });

    // validate — do NOT rely on disabled attr (we removed it)
    const missing = validateMissing();
    if (missing.length > 0) {
      console.warn("[Prescreen] missing answers:", missing);
      alert("Please complete: \n• " + missing.join("\n• "));
      return;
    }

    setSubmitting(true);
    try {
      if (questions.length > 0) {
        const { url, body } = buildAnswersPayload();
        // fire-and-forget; redirect does not wait
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        })
          .then(async (r) => {
            const t = await r.clone().text().catch(() => "");
            console.log("[Prescreen] answers POST =>", r.status, t);
          })
          .catch((e) => console.warn("[Prescreen] POST failed (ignored):", e));
      }

      const dest = destinationAfterPrescreen();
      // belt & suspenders navigation
      window.location.assign(dest);
      setTimeout(() => {
        if (!document.hidden) window.location.href = dest;
      }, 150);
    } catch (e: any) {
      console.error("[Prescreen] submit error:", e?.message || e);
      const dest = destinationAfterPrescreen();
      window.location.assign(dest);
      setTimeout(() => {
        if (!document.hidden) window.location.href = dest;
      }, 150);
    }
  }

  // If there are no pending questions, auto-continue
  useEffect(() => {
    if (!loading && questions.length === 0 && projectId && rid) {
      const dest = destinationAfterPrescreen();
      window.location.assign(dest);
      setTimeout(() => {
        if (!document.hidden) window.location.href = dest;
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questions.length, projectId, rid]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading prescreen…</div>;
  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>;
  if (!questions.length) return null;

  return (
    <div className="max-w-3xl p-6 mx-auto">
      {/* Tiny debug strip — remove later */}
      <div className="mb-2 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
        canSubmit: <b>{String(canSubmit)}</b> · submitting: <b>{String(submitting)}</b> ·
        qCount: <b>{questions.length}</b>
      </div>

      <h1 className="mb-4 text-xl font-semibold text-slate-800">Prescreen</h1>

      {/* noValidate so browser HTML5 validation doesn’t swallow submit */}
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 text-sm text-slate-600">
              {idx + 1}. {q.question}
            </div>

            {q.controlType === "TEXT" && (
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            )}

            {q.controlType === "RADIO" && (
              <div className="space-y-2">
                {(q.options || []).map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      value={o.value}
                      checked={answers[q.id] === o.value}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}

            {q.controlType === "DROPDOWN" && (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              >
                <option value="">-- Select --</option>
                {(q.options || []).map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            {q.controlType === "CHECKBOX" && (
              <div className="space-y-2">
                {(q.options || []).map((o) => {
                  const arr: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                  const checked = arr.includes(o.value);
                  return (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setAnswers((a) => {
                            const prev = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
                            return {
                              ...a,
                              [q.id]: e.target.checked
                                ? [...prev, o.value]
                                : prev.filter((v) => v !== o.value),
                            };
                          });
                        }}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        <div className="flex justify-end">
          {/* IMPORTANT: type="button"; not disabled; onClick handles everything */}
          <button
            type="button"
            onClick={() => void submitCore()}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            data-testid="prescreen-continue"
          >
            {submitting ? "Submitting…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PrescreenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading…</div>}>
      <PrescreenInner />
    </Suspense>
  );
}