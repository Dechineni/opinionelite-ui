"use client";
export const runtime = "edge";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// This page depends on URL params, don't prerender.
export const dynamic = "force-dynamic";

function SurveyLandingInner() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const projectId = sp.get("projectId") || "";
    const supplierId = sp.get("supplierId") || "";
    const id = sp.get("id") || "";

    if (!projectId || !id) return;

    const toLive = () => {
      window.location.href = `/api/projects/${encodeURIComponent(
        projectId
      )}/survey-live?supplierId=${encodeURIComponent(supplierId)}&id=${encodeURIComponent(id)}`;
    };
    const toPrescreen = () => {
      router.replace(
        `/Prescreen?projectId=${encodeURIComponent(projectId)}&supplierId=${encodeURIComponent(
          supplierId
        )}&id=${encodeURIComponent(id)}`
      );
    };

    (async () => {
      try {
        // Single source of truth:
        // This endpoint accepts project *id or code* and now also returns preScreenEnabled.
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/prescreen/${encodeURIComponent(
            id
          )}/pending?supplierId=${encodeURIComponent(supplierId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          // Any failure -> live link
          toLive();
          return;
        }

        const json = await res.json();
        const preScreenEnabled =
          typeof json?.preScreenEnabled === "boolean" ? json.preScreenEnabled : false;

        // If Prescreen is OFF, go straight to live regardless of stored questions
        if (!preScreenEnabled) {
          toLive();
          return;
        }

        const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
        if (items.length > 0) {
          toPrescreen();
        } else {
          toLive();
        }
      } catch {
        toLive();
      }
    })();
  }, [sp, router]);

  return null;
}

export default function SurveyLandingPage() {
  return (
    <Suspense fallback={null}>
      <SurveyLandingInner />
    </Suspense>
  );
}