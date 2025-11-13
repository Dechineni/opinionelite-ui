"use client";
export const runtime = "edge";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

type ControlType = "TEXT" | "RADIO" | "DROPDOWN" | "CHECKBOX";
type TextType = "EMAIL" | "CONTACTNO" | "ZIPCODE" | "CUSTOM";

type PrescreenQuestion = {
  id: string;
  title: string;
  question: string;
  controlType: ControlType;
  textMinLength?: number | null;
  textMaxLength?: number | null;
  textType?: TextType | null;
  options?: Array<{ id: string; label: string; value: string }>;
};

function PrescreenInner() {
  const params = useSearchParams();
  const router = useRouter();

  const projectId = params.get("projectId") || "";
  // Support both ?identifier=… (new) and ?id=… (legacy)
  const rid = params.get("identifier") || params.get("id") || "";
  // supplierId is optional in DB; don’t block the page if it’s absent
  const supplierId = params.get("supplierId") || "";
  // When provided by /survey-live gate, this is the “resume” URL after prescreen
  const nextUrl = params.get("next") || "";

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<PrescreenQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Early guard: we at least need projectId + rid
  useEffect(() => {
    if (!projectId || !rid) {
      setError("Missing project or identifier.");
      setLoading(false);
    }
  }, [projectId, rid]);

  // Load pending questions
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!projectId || !rid) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (supplierId) qs.set("supplierId", supplierId); // only send if present

        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/prescreen/${encodeURIComponent(
            rid
          )}/pending${qs.toString() ? `?${qs.toString()}` : ""}`,
          { cache: "no-store" }
        );
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
    }

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

  // Helper: go to “next” (preferred) or fall back to /survey-live
  function continueToSurveyLive() {
    if (nextUrl) {
      window.location.href = nextUrl; // preserve full URL including any params added by gate
      return;
    }
    const fallback = new URL(
      `/api/projects/${encodeURIComponent(projectId)}/survey-live`,
      window.location.origin
    );
    if (supplierId) fallback.searchParams.set("supplierId", supplierId);
    fallback.searchParams.set("id", rid);
    window.location.href = fallback.toString();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !rid || submitting) return;

    if (questions.length === 0) {
      continueToSurveyLive();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const flatAnswers = questions.map((q) => {
        const v = answers[q.id];
        return {
          questionId: q.id,
          value: q.controlType === "CHECKBOX" ? (Array.isArray(v) ? v : []) : String(v ?? ""),
        };
      });

      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/prescreen/${encodeURIComponent(rid)}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId: supplierId || null,
            answers: flatAnswers,
          }),
        }
      );

      continueToSurveyLive();
    } catch (e: any) {
      setError(e?.message || "Submit failed");
      setSubmitting(false);
    }
  }

  // If there are no pending questions, auto-continue
  useEffect(() => {
    if (!loading && questions.length === 0 && projectId && rid) {
      continueToSurveyLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questions.length, projectId, rid]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading prescreen…</div>;
  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>;
  if (!questions.length) return null;

  return (
    <div className="max-w-3xl p-6 mx-auto">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Prescreen</h1>

      <form onSubmit={onSubmit} className="space-y-6">
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

        {error && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
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