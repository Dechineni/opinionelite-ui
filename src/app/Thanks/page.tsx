// FILE: src/app/Thanks/page.tsx
export const runtime = 'edge';

"use client";

import { useEffect } from "react";

// Small client helper for timed redirect
function AutoRedirect({ next }: { next?: string }) {
  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => {
      try {
        window.location.href = next;
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [next]);
  return null;
}

export default function ThanksPage() {
  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const status = (sp.get("status") || "").toUpperCase();
  const pid = sp.get("pid") || "";
  const next = sp.get("next") || undefined;

  const MESSAGES: Record<string, { title: string; body: string }> = {
    COMPLETE: {
      title: "Thank you!",
      body: "Thanks for completing our survey! Your response has been recorded.",
    },
    TERMINATE: {
      title: "Thank you!",
      body: "Thanks for your time. Unfortunately you are not qualified for this survey.",
    },
    QUALITY_TERM: {
      title: "Thank you!",
      body: "Thanks for your time. Unfortunately you are not qualified for this survey.",
    },
    OVER_QUOTA: {
      title: "Thank you!",
      body: "Thanks for your time. Unfortunately we no longer need responses for this survey.",
    },
    SURVEY_CLOSE: {
      title: "Thank you!",
      body: "Thanks for your time. Unfortunately we no longer need responses for this survey.",
    },
  };

  const msg =
    MESSAGES[status] ?? {
      title: "Thank you!",
      body: "Your response has been received.",
    };

  return (
    <main className="min-h-[60vh] px-6 py-16 flex items-center justify-center bg-slate-50">
      <AutoRedirect next={next} />
      <div className="max-w-xl w-full rounded-2xl bg-white shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{msg.title}</h1>
        <p className="mt-3 text-slate-600">{msg.body}</p>

        {pid ? <p className="mt-4 text-xs text-slate-400">Ref: {pid}</p> : null}

        <div className="mt-8">
          {next ? (
            <a
              href={next}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Continue
            </a>
          ) : (
            <a
              href="/"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Back to home
            </a>
          )}
        </div>

        {next ? (
          <p className="mt-2 text-xs text-slate-400">You’ll be redirected automatically in a moment…</p>
        ) : null}
      </div>
    </main>
  );
}