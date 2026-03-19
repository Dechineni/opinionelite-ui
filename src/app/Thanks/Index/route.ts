export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const isP2002 = (e: any) => {
  const msg = String(e?.message || "");
  return (
    (e && e.code === "P2002") ||
    /Unique constraint failed/i.test(msg) ||
    /duplicate key value violates unique constraint/i.test(msg)
  );
};

function mapAuth(aRaw: string | null | undefined) {
  const a = (aRaw || "").toLowerCase().trim();
  if (a === "c" || a === "10")
    return { redirectResult: "COMPLETE" as const, eventOutcome: "COMPLETE" as const };
  if (a === "t" || a === "20")
    return { redirectResult: "TERMINATE" as const, eventOutcome: "TERMINATE" as const };
  if (a === "q" || a === "40")
    return { redirectResult: "OVERQUOTA" as const, eventOutcome: "OVER_QUOTA" as const };
  if (a === "f" || a === "30")
    return { redirectResult: "QUALITYTERM" as const, eventOutcome: "QUALITY_TERM" as const };
  if (a === "sc" || a === "70")
    return { redirectResult: "CLOSE" as const, eventOutcome: "SURVEY_CLOSE" as const };
  return { redirectResult: null, eventOutcome: null };
}

function fillIdentifier(rawUrl: string, identifier: string) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.forEach((v, k) => {
      if (/\[identifier\]/i.test(v)) {
        u.searchParams.set(k, v.replace(/\[identifier\]/gi, identifier));
      }
      if (["id", "rid"].includes(k.toLowerCase()) && v.toLowerCase() === "identifier") {
        u.searchParams.set(k, identifier);
      }
    });
    let s = u.toString();
    s = s.replace(/\[identifier\]/gi, identifier);
    return s;
  } catch {
    return rawUrl
      .replace(/\[identifier\]/gi, identifier)
      .replace(/(id|rid)=identifier/gi, `$1=${identifier}`);
  }
}

const looksLikePid = (s: string) => /^[0-9A-Za-z]{20}$/.test(s);

export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const url = new URL(req.url);
    const auth = url.searchParams.get("auth");
    const ridIn = (url.searchParams.get("pid") || url.searchParams.get("rid") || "").trim();

    const mapped = mapAuth(auth);
    if (!mapped.redirectResult || !mapped.eventOutcome) {
      return NextResponse.json({ ok: false, error: "Invalid or missing auth" }, { status: 400 });
    }
    if (!ridIn) {
      return NextResponse.json({ ok: false, error: "Missing pid/rid" }, { status: 400 });
    }

    let redirect =
      looksLikePid(ridIn)
        ? await prisma.surveyRedirect.findUnique({
            where: { id: ridIn },
            select: {
              id: true,
              projectId: true,
              supplierId: true,
              respondentId: true,
              externalId: true,
              destination: true,
              result: true,
            },
          })
        : null;

    if (!redirect && !looksLikePid(ridIn)) {
      redirect = await prisma.surveyRedirect.findFirst({
        where: { externalId: ridIn },
        orderBy: { createdAt: "desc" },
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
    }

    if (!redirect) {
      return NextResponse.json(
        { ok: false, error: "Redirect context not found. (pid/externalId mismatch)" },
        { status: 400 }
      );
    }

    const pid = redirect.id;
    const projectId = redirect.projectId ?? null;
    const supplierId = redirect.supplierId ?? null;
    const externalId = redirect.externalId ?? null;

    // Resolve supplier record – treat redirect.supplierId as either Supplier.id or Supplier.code
    let supplierRecord:
      | {
          id: string;
          code: string;
          completeUrl: string | null;
          terminateUrl: string | null;
          overQuotaUrl: string | null;
          qualityTermUrl: string | null;
          surveyCloseUrl: string | null;
        }
      | null = null;

    if (supplierId) {
      supplierRecord = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: {
          id: true,
          code: true,
          completeUrl: true,
          terminateUrl: true,
          overQuotaUrl: true,
          qualityTermUrl: true,
          surveyCloseUrl: true,
        },
      });

      if (!supplierRecord) {
        supplierRecord = await prisma.supplier.findUnique({
          where: { code: supplierId },
          select: {
            id: true,
            code: true,
            completeUrl: true,
            terminateUrl: true,
            overQuotaUrl: true,
            qualityTermUrl: true,
            surveyCloseUrl: true,
          },
        });
      }
    }

    const supplierIdForEvent = supplierRecord?.id ?? null;

    // Ensure respondent (no upsert)
    let respondentId = redirect.respondentId ?? null;
    if (!respondentId && projectId && externalId) {
      if (supplierId) {
        try {
          const created = await prisma.respondent.create({
            data: { projectId, externalId, supplierId },
            select: { id: true },
          });
          respondentId = created.id;
        } catch (e) {
          if (isP2002(e)) {
            const found = await prisma.respondent.findUnique({
              where: { projectId_externalId_supplierId: { projectId, externalId, supplierId } },
              select: { id: true },
            });
            respondentId = found?.id ?? null;
          } else {
            throw e;
          }
        }
      } else {
        const found = await prisma.respondent.findFirst({
          where: { projectId, externalId, supplierId: null },
          select: { id: true },
        });
        if (found) {
          respondentId = found.id;
        } else {
          try {
            const created = await prisma.respondent.create({
              data: { projectId, externalId, supplierId: null },
              select: { id: true },
            });
            respondentId = created.id;
          } catch (e) {
            if (isP2002(e)) {
              const again = await prisma.respondent.findFirst({
                where: { projectId, externalId, supplierId: null },
                select: { id: true },
              });
              respondentId = again?.id ?? null;
            } else {
              throw e;
            }
          }
        }
      }

      prisma.surveyRedirect.update({ where: { id: pid }, data: { respondentId } }).catch(() => {});
    }

    // Persist outcome on SurveyRedirect
    if (redirect.result !== mapped.redirectResult) {
      await prisma.surveyRedirect
        .update({ where: { id: pid }, data: { result: mapped.redirectResult } })
        .catch(() => {});
    }

    // Write SupplierRedirectEvent
    if (projectId) {
      try {
        await prisma.supplierRedirectEvent.create({
          data: {
            projectId,
            supplierId: supplierIdForEvent,
            respondentId: respondentId ?? null,
            pid,
            outcome: mapped.eventOutcome as any,
          },
        });
      } catch (e) {
        console.log("prisma:error", e);
      }
    }

    // Next hop:
    // Business wants supplier-side callback FIRST for ALL outcomes (including COMPLETE).
    // If supplier URL missing for COMPLETE, fall back to OP Panel complete page.
    let nextUrl: string | null = null;

    // Prefer Respondent.id (unique cuid) for supplier callbacks, then pid, then externalId.
    const supplierIdent = respondentId ?? pid ?? externalId ?? "";

    if (supplierRecord) {
      const r = mapped.redirectResult;
      const tpl =
        r === "COMPLETE"
          ? supplierRecord.completeUrl
          : r === "TERMINATE"
          ? supplierRecord.terminateUrl
          : r === "OVERQUOTA"
          ? supplierRecord.overQuotaUrl
          : r === "QUALITYTERM"
          ? supplierRecord.qualityTermUrl
          : r === "CLOSE"
          ? supplierRecord.surveyCloseUrl
          : null;

      if (tpl) {
        nextUrl = fillIdentifier(tpl, supplierIdent);
      }
    }

    // If COMPLETE and supplier doesn't have a completeUrl configured, fall back to OP Panel complete page.
    if (!nextUrl && mapped.redirectResult === "COMPLETE") {
      const opPanelBase =
        (process.env.OP_PANEL_API_BASE || "").trim() || "https://opinionelite.com";
      const u = new URL("/UI/complete.php", opPanelBase.replace(/\/$/, "") + "/");
      u.searchParams.set("pid", pid);
      if (externalId) u.searchParams.set("id", externalId);
      nextUrl = u.toString();
    }

    const thanksUrl = new URL("/Thanks", url.origin);
    thanksUrl.searchParams.set("status", mapped.redirectResult);
    thanksUrl.searchParams.set("pid", pid);
    if (nextUrl) {
      thanksUrl.searchParams.set("next", nextUrl);
    }

    return NextResponse.redirect(thanksUrl.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}