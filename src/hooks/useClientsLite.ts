"use client";

import { useEffect, useState } from "react";

export type ClientLite = { id: string; name: string };

export function useClientsLite() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const url = `/api/client?mode=lite&page=1&pageSize=1000`; // cache-buster

    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setClients(items.map((x: any) => ({ id: String(x.id), name: String(x.name) })));
      } catch (e: any) {
        setError(e?.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, []);

  return { clients, loading, error };
}