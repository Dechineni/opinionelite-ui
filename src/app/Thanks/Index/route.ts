// FILE: src/app/Thanks/Index/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/** Map auth -> our two enums */
function mapAuth(
  authRaw: string | null | undefined
): {
  redirectResult: "COMPLETE" | "TERMINATE" | "OVERQUOTA" | "QUALITYTERM" | "CLOSE" | null;
  eventOutcome:  "COMPLETE" | "TERMINATE" | "OVER_QUOTA" | "DROP_OUT" | "QUALITY_TERM" | "SURVEY_CLOSE" | null;
} {
  const a = (authRaw || "").toLowerCase().trim();

  // short codes
  if (a === "c") return { redirectResult: "COMPLETE",   eventOutcome: "COMPLETE" };
  if (a === "t") return { redirectResult: "TERMINATE",  eventOutcome: "TERMINATE" };
  if (a === "q") return { redirectResult: "OVERQUOTA",  eventOutcome: "OVER_QUOTA" };
  if (a === "f") return { redirectResult: "QUALITYTERM",eventOutcome: "QUALITY_TERM" };
  if (a === "sc")return { redirectResult: "CLOSE",      eventOutcome: "SURVEY_CLOSE" };

  // numeric codes used in your UI
  switch (a) {
    case "10": return { redirectResult: "COMPLETE",    eventOutcome: "COMPLETE" };
    case "20": return { redirectResult: "TERMINATE",   eventOutcome: "TERMINATE" };
    case "30": return { redirectResult: "QUALITYTERM", eventOutcome: "QUALITY_TERM" };
    case "40": return { redirectResult: "OVERQUOTA",   eventOutcome: "OVER_QUOTA" };
    case "70": return { redirectResult: "CLOSE",       eventOutcome: "SURVEY_CLOSE" };
    default:   return { redirectResult: null, eventOutcome: null };
  }
}

/** Replace [identifier] in supplier URLs */
function fillIdentifier(rawUrl: string, supplierIdentifier: string) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.forEach((v, k) => {
      if (/\[identifier\]/i.test(v)) {
        u.searchParams.set(k, v.replace(/\[identifier\]/gi, supplierIdentifier));
      }
      if (["id", "rid"].includes(k.toLowerCase()) && v.toLowerCase() === "identifier") {
        u.searchParams.set(k, supplierIdentifier);
      }
    });
    let s = u.toString();
    s = s.replace(/\[identifier\]/gi, supplierIdentifier);
    return s;
  } catch {
    return rawUrl
      .replace(/\[identifier\]/gi, supplierIdentifier)
      .replace(/(id|rid)=identifier/gi, `$1=${supplierIdentifier}`);
  }
}

export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const url  = new URL(req.url);
    const auth = url.searchParams.get("auth");
    const rid  = url.searchParams.get("rid"); // our pid

    const mapped = mapAuth(auth);
    if (!mapped.redirectResult || !mapped.eventOutcome) {
      return NextResponse.json({ ok: false, error: "Invalid or missing auth" }, { status: 400 });
    }
    if (!rid) {
      return NextResponse.json({ ok: false, error: "Missing rid" }, { status: 400 });
    }

    // Load the redirect row if it exists
    let redirect = await prisma.surveyRedirect.findUnique({
      where: { id: rid },
      select: {
        id: true,
        projectId: true,
        supplierId: true,
        respondentId: true,
        externalId: true,
        destination: true,
        result: true,
      },
    });

    // If missing (edge write was lost), create a minimal one now
    if (!redirect) {
      redirect = await prisma.surveyRedirect.create({
        data: {
          id: rid,
          projectId: null as any,        // unknown here; safe to keep null (schema allows)
          supplierId: null,
          externalId: null,
          destination: "",
          result: mapped.redirectResult, // set outcome now
        } as any,                        // cast since projectId is nullable in practice here
        select: {
          id: true, projectId: true, supplierId: true, respondentId: true, externalId: true, destination: true, result: true
        },
      });
    } else if (redirect.result !== mapped.redirectResult) {
      // Update the result so groupBy in supplier-maps works
      await prisma.surveyRedirect.update({
        where: { id: rid },
        data: { result: mapped.redirectResult },
      });
    }

    const projectId  = redirect.projectId ?? null;
    const supplierId = redirect.supplierId ?? null;

    // Record SupplierRedirectEvent (best-effort)
    try {
      await prisma.supplierRedirectEvent.create({
        data: {
          projectId: projectId as any, // may be null; schema expects string — if you prefer, make it optional
          supplierId,
          respondentId: redirect.respondentId ?? null,
          pid: rid,
          outcome: mapped.eventOutcome as any,
        },
      });
    } catch {
      // ignore
    }

    // Optional bounce back to supplier specific URL
    let nextUrl: string | null = null;
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: {
          code: true,
          completeUrl: true,
          terminateUrl: true,
          overQuotaUrl: true,
          qualityTermUrl: true,
          surveyCloseUrl: true,
        },
      });

      if (supplier) {
        let tpl: string | null = null;
        const r = mapped.redirectResult;
        if (r === "COMPLETE")    tpl = supplier.completeUrl;
        else if (r === "TERMINATE")  tpl = supplier.terminateUrl;
        else if (r === "OVERQUOTA")  tpl = supplier.overQuotaUrl;
        else if (r === "QUALITYTERM")tpl = supplier.qualityTermUrl;
        else if (r === "CLOSE")      tpl = supplier.surveyCloseUrl;

        if (tpl) nextUrl = fillIdentifier(tpl, supplier.code || supplierId);
      }
    }

    // Redirect to your /Thanks UI with status + pid (+ optional next)
    const thanksUrl = new URL("/Thanks", url.origin);
    thanksUrl.searchParams.set("status", mapped.redirectResult);
    thanksUrl.searchParams.set("pid", rid);
    if (nextUrl) thanksUrl.searchParams.set("next", nextUrl);

    return NextResponse.redirect(thanksUrl.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}