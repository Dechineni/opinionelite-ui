// FILE: src/app/Survey/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SurveyLanding() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const projectId = sp.get("projectId");
    const supplierId = sp.get("supplierId") ?? "";
    const id = sp.get("id") ?? "";

    if (!projectId || !id) return;

    (async () => {
      try {
        // Ask API for *pending* prescreen questions for this respondent (supplier-scoped)
        const pendingRes = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/prescreen/${encodeURIComponent(
            id
          )}/pending?supplierId=${encodeURIComponent(supplierId)}`,
          { cache: "no-store" }
        );

        if (!pendingRes.ok) throw new Error(await pendingRes.text());
        const pendingJson = await pendingRes.json();
        const pending = Array.isArray(pendingJson?.items)
          ? pendingJson.items
          : Array.isArray(pendingJson)
          ? pendingJson
          : [];

        if (pending.length > 0) {
          // Go to Prescreen page (UI for questions)
          router.replace(
            `/Prescreen?projectId=${encodeURIComponent(projectId)}&supplierId=${encodeURIComponent(
              supplierId
            )}&id=${encodeURIComponent(id)}`
          );
        } else {
          // No pending → jump straight to provider live link
          window.location.href = `/api/projects/${encodeURIComponent(
            projectId
          )}/survey-live?supplierId=${encodeURIComponent(supplierId)}&id=${encodeURIComponent(id)}`;
        }
      } catch {
        // On any failure, default to live link
        window.location.href = `/api/projects/${encodeURIComponent(
          projectId
        )}/survey-live?supplierId=${encodeURIComponent(supplierId)}&id=${encodeURIComponent(id)}`;
      }
    })();
  }, [sp, router]);

  return null;
}