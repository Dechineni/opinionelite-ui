"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Outcome = "10" | "20" | "40" | "30" | "70";

function buildThanksUrl(rid: string, auth: Outcome) {
  // Thanks/Index is server route (records result + event)
  return `/Thanks/Index?auth=${encodeURIComponent(auth)}&rid=${encodeURIComponent(rid)}`;
}

export default function TestSurveyIndexPage() {
  const sp = useSearchParams();
  const rid = (sp.get("rid") || "").trim();

  const [step, setStep] = useState(1);
  const [q1, setQ1] = useState<string>("");
  const [q2, setQ2] = useState<string>("");

  const canNext = useMemo(() => {
    if (!rid) return false;
    if (step === 1) return q1 !== "";
    if (step === 2) return q2 !== "";
    return true;
  }, [rid, step, q1, q2]);

  const go = (auth: Outcome) => {
    if (!rid) return;
    window.location.href = buildThanksUrl(rid, auth);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Test Survey Provider</h1>

      <div
        style={{
          marginTop: 10,
          padding: 12,
          background: "#111",
          border: "1px solid #333",
          borderRadius: 10,
          color: "#ddd",
          fontSize: 13,
        }}
      >
        <div>
          <b>RID:</b> {rid || "Missing rid (expected ?rid=...)"}
        </div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          This is a self-hosted test survey used to simulate a real provider end-to-end.
        </div>
      </div>

      {!rid ? (
        <div style={{ marginTop: 18, color: "#ffb3b3" }}>
          Missing <b>rid</b>. Please open this page with <code>?rid=YOUR_ID</code>.
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            padding: 18,
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: 12,
            color: "#fff",
          }}
        >
          {step === 1 && (
            <>
              <h2 style={{ fontSize: 16, margin: 0 }}>Q1) Do you like trying new products?</h2>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {["Yes", "No"].map((v) => (
                  <label key={v} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="q1"
                      value={v}
                      checked={q1 === v}
                      onChange={() => setQ1(v)}
                    />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ fontSize: 16, margin: 0 }}>Q2) Which category interests you most?</h2>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {["Tech", "Food", "Travel"].map((v) => (
                  <label key={v} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="q2"
                      value={v}
                      checked={q2 === v}
                      onChange={() => setQ2(v)}
                    />
                    <span>{v}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ fontSize: 16, margin: 0 }}>Finish Survey</h2>
              <p style={{ marginTop: 10, color: "#ddd" }}>
                Choose the outcome to simulate what a real provider would redirect to.
              </p>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => go("10")} style={btnPrimary}>
                  Complete (auth=10)
                </button>
                <button onClick={() => go("20")} style={btnSecondary}>
                  Terminate (auth=20)
                </button>
                <button onClick={() => go("40")} style={btnSecondary}>
                  OverQuota (auth=40)
                </button>
                <button onClick={() => go("30")} style={btnSecondary}>
                  Quality Term (auth=30)
                </button>
                <button onClick={() => go("70")} style={btnSecondary}>
                  Survey Close (auth=70)
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              style={btnNav}
            >
              Back
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                disabled={!canNext}
                style={{ ...btnNav, opacity: canNext ? 1 : 0.6 }}
              >
                Next
              </button>
            ) : (
              <button onClick={() => setStep(1)} style={btnNav}>
                Restart
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  background: "#ff9800",
  color: "#000",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2b2b2b",
  color: "#fff",
  border: "1px solid #555",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};

const btnNav: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2b2b2b",
  color: "#fff",
  border: "1px solid #555",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};