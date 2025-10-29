"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // IMPORTANT: so browser accepts Set-Cookie from the response
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Login failed");
      setSubmitting(false);
      return;
    }

    // Where to go after login
    const next = searchParams.get("next") || "/dashboard";

    // Navigate and force server components to re-read cookies
    router.replace(next);
    router.refresh(); // <- important when cookies are httpOnly
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex flex-col items-center gap-1">
          <Image src="/logo.svg" alt="Opinion Elite" width={64} height={64} />
          <div className="text-lg font-semibold">OpinionElite</div>
        </div>

        <label className="mb-1 block text-sm font-medium">Email Address / User</label>
        <input
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          type="email"
          placeholder="admin@demo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}