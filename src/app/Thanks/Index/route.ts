// FILE: src/app/Thanks/Index/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

/** Map provider 'auth' to our enums */
function mapAuth(aRaw: string | null | undefined) {
  const a = (aRaw || "").toLowerCase().trim();
  // short codes
  if (a === "c") return { redirectResult: "COMPLETE" as const,    eventOutcome: "COMPLETE" as const };
  if (a === "t") return { redirectResult: "TERMINATE" as const,   eventOutcome: "TERMINATE" as const };
  if (a === "q") return { redirectResult: "OVERQUOTA" as const,   eventOutcome: "OVER_QUOTA" as const };
  if (a === "f") return { redirectResult: "QUALITYTERM" as const, eventOutcome: "QUALITY_TERM" as const };
  if (a === "sc")return { redirectResult: "CLOSE" as const,       eventOutcome: "SURVEY_CLOSE" as const };
  // numeric codes from your UI
  switch (a) {
    case "10": return { redirectResult: "COMPLETE" as const,    eventOutcome: "COMPLETE" as const };
    case "20": return { redirectResult: "TERMINATE" as const,   eventOutcome: "TERMINATE" as const };
    case "30": return { redirectResult: "QUALITYTERM" as const, eventOutcome: "QUALITY_TERM" as const };
    case "40": return { redirectResult: "OVERQUOTA" as const,   eventOutcome: "OVER_QUOTA" as const };
    case "70": return { redirectResult: "CLOSE" as const,       eventOutcome: "SURVEY_CLOSE" as const };
    default:   return { redirectResult: null, eventOutcome: null };
  }
}

/** Replace [identifier] (and common id/rid placeholders) in supplier URLs */
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

/** Heuristic: does s look like our 20-char pid? */
const looksLikePid = (s: string) => /^[0-9A-Za-z]{20}$/.test(s);

export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const url   = new URL(req.url);
    const auth  = url.searchParams.get("auth");
    // provider may send back either 'pid' or 'rid' — normalize
    const ridIn = (url.searchParams.get("pid") || url.searchParams.get("rid") || "").trim();

    const mapped = mapAuth(auth);
    if (!mapped.redirectResult || !mapped.eventOutcome) {
      return NextResponse.json({ ok: false, error: "Invalid or missing auth" }, { status: 400 });
    }
    if (!ridIn) {
      return NextResponse.json({ ok: false, error: "Missing pid/rid" }, { status: 400 });
    }

    // 1) Resolve the redirect row
    let redirect =
      looksLikePid(ridIn)
        ? await prisma.surveyRedirect.findUnique({
            where: { id: ridIn },
            select: { id:true, projectId:true, supplierId:true, respondentId:true, externalId:true, destination:true, result:true }
          })
        : null;

    // Legacy path: rid was actually supplier identifier; find most recent by externalId
    if (!redirect && !looksLikePid(ridIn)) {
      redirect = await prisma.surveyRedirect.findFirst({
        where: { externalId: ridIn },
        orderBy: { createdAt: "desc" },
        select: { id:true, projectId:true, supplierId:true, respondentId:true, externalId:true, destination:true, result:true }
      });
    }

    if (!redirect) {
      return NextResponse.json(
        { ok:false, error:"Redirect context not found. (pid/externalId mismatch)"},
        { status: 400 }
      );
    }

    const pid        = redirect.id;
    const projectId  = redirect.projectId ?? null;
    const supplierId = redirect.supplierId ?? null;
    const externalId = redirect.externalId ?? null;

    // 2) Ensure we have a respondent and backfill it on the redirect row
    let respondentId = redirect.respondentId ?? null;
    if (!respondentId && projectId && externalId) {
      if (supplierId) {
        const r = await prisma.respondent.upsert({
          where: {
            projectId_externalId_supplierId: { projectId, externalId, supplierId },
          },
          create: { projectId, externalId, supplierId },
          update: {},
          select: { id: true },
        });
        respondentId = r.id;
      } else {
        const existing = await prisma.respondent.findFirst({
          where: { projectId, externalId, supplierId: null },
          select: { id: true },
        });
        if (existing) {
          respondentId = existing.id;
        } else {
          const created = await prisma.respondent.create({
            data: { projectId, externalId, supplierId: null },
            select: { id: true },
          });
          respondentId = created.id;
        }
      }
      prisma.surveyRedirect.update({
        where: { id: pid },
        data: { respondentId },
      }).catch(() => {});
    }

    // 3) Persist the outcome on SurveyRedirect so reporting matches (if you keep grouping from this table)
    if (redirect.result !== mapped.redirectResult) {
      await prisma.surveyRedirect.update({
        where: { id: pid },
        data: { result: mapped.redirectResult },
      });
    }

    // 4) Write SupplierRedirectEvent idempotently (one row per pid)
    if (projectId) {
      prisma.supplierRedirectEvent.upsert({
        where: { pid }, // unique
        update: {
          outcome: mapped.eventOutcome as any,
          respondentId: respondentId ?? null,
          supplierId: supplierId ?? null,
        },
        create: {
          projectId,
          supplierId: supplierId ?? null,
          respondentId: respondentId ?? null,
          pid,
          outcome: mapped.eventOutcome as any,
        },
      }).catch(() => {});
    }

    // 5) Optional bounce to supplier “result” URL
    let nextUrl: string | null = null;
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: {
          code: true,
          completeUrl: true, terminateUrl: true,
          overQuotaUrl: true, qualityTermUrl: true, surveyCloseUrl: true,
        },
      });
      if (supplier) {
        const r = mapped.redirectResult;
        const tpl =
          r === "COMPLETE"    ? supplier.completeUrl
        : r === "TERMINATE"   ? supplier.terminateUrl
        : r === "OVERQUOTA"   ? supplier.overQuotaUrl
        : r === "QUALITYTERM" ? supplier.qualityTermUrl
        : r === "CLOSE"       ? supplier.surveyCloseUrl
        : null;

        if (tpl) nextUrl = fillIdentifier(tpl, supplier.code || supplierId);
      }
    }

    // 6) Redirect to your /Thanks UI with status + pid (+ optional next)
    const thanksUrl = new URL("/Thanks", url.origin);
    thanksUrl.searchParams.set("status", mapped.redirectResult);
    thanksUrl.searchParams.set("pid", pid);
    if (nextUrl) thanksUrl.searchParams.set("next", nextUrl);

    return NextResponse.redirect(thanksUrl.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}