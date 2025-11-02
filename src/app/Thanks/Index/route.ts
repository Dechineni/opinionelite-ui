// FILE: src/app/Thanks/Index/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// Map auth → status (accept numeric and short codes)

function authToStatus(authRaw: string | null | undefined) {
  const a = (authRaw || "").toLowerCase().trim();
  // short codes
  if (a === "c") return "COMPLETE" as const;
  if (a === "t") return "TERMINATE" as const;
  if (a === "q") return "OVER_QUOTA" as const;
  if (a === "f") return "QUALITY_TERM" as const;
  if (a === "sc") return "SURVEY_CLOSE" as const;
  // numeric codes (as used in Project Detail)
  switch (a) {
    case "10": return "COMPLETE";
    case "20": return "TERMINATE";
    case "30": return "QUALITY_TERM";
    case "40": return "OVER_QUOTA";
    case "70": return "SURVEY_CLOSE";
    default: return null;
  }
}

// Fill supplier URL with its identifier (replace [identifier] & common placeholders)
function fillIdentifier(rawUrl: string, supplierIdentifier: string) {
  try {
    const u = new URL(rawUrl);
    // Replace any param that literally contains "[identifier]"
    u.searchParams.forEach((v, k) => {
      if (/\[identifier\]/i.test(v)) {
        u.searchParams.set(k, v.replace(/\[identifier\]/gi, supplierIdentifier));
      }
      // If someone uses id=identifier or rid=identifier
      if (["id", "rid"].includes(k.toLowerCase()) && v.toLowerCase() === "identifier") {
        u.searchParams.set(k, supplierIdentifier);
      }
    });
    // Also replace in pathname just in case templates were used there
    let asString = u.toString();
    asString = asString.replace(/\[identifier\]/gi, supplierIdentifier);
    return asString;
  } catch {
    // Fallback to blind replace if URL constructor fails
    return rawUrl.replace(/\[identifier\]/gi, supplierIdentifier).replace(/(id|rid)=identifier/gi, `$1=${supplierIdentifier}`);
  }
}

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const url = new URL(req.url);
    const auth = url.searchParams.get("auth");
    const rid  = url.searchParams.get("rid"); // your 20-char pid

    const status = authToStatus(auth);
    if (!status) {
      return NextResponse.json({ ok: false, error: "Invalid or missing auth" }, { status: 400 });
    }
    if (!rid) {
      return NextResponse.json({ ok: false, error: "Missing rid" }, { status: 400 });
    }

    // Which redirect did we issue earlier?
    const redirect = await prisma.surveyRedirect.findUnique({
      where: { id: rid },
      select: { projectId: true, supplierId: true, respondentId: true },
    });

    if (!redirect) {
      // don't block client; we still show thank-you UI
      const fallback = `/Thanks?status=${encodeURIComponent(status)}&pid=${encodeURIComponent(rid)}`;
      return NextResponse.redirect(fallback, { status: 302 });
    }

    // Load supplier to get the 5 URLs + its public identifier
    const supplier =
      redirect.supplierId
        ? await prisma.supplier.findUnique({
            where: { id: redirect.supplierId },
            select: {
              id: true,
              code: true,
              completeUrl: true,
              terminateUrl: true,
              overQuotaUrl: true,
              qualityTermUrl: true,
              surveyCloseUrl: true,
            },
          })
        : null;

    // Choose the corresponding supplier URL (may be null)
    let supplierUrlTemplate: string | null = null;
    if (supplier) {
      if (status === "COMPLETE") supplierUrlTemplate = supplier.completeUrl;
      else if (status === "TERMINATE") supplierUrlTemplate = supplier.terminateUrl;
      else if (status === "OVER_QUOTA") supplierUrlTemplate = supplier.overQuotaUrl;
      else if (status === "QUALITY_TERM") supplierUrlTemplate = supplier.qualityTermUrl;
      else if (status === "SURVEY_CLOSE") supplierUrlTemplate = supplier.surveyCloseUrl;
    }

    // Final supplier URL with identifier substituted (prefer code; fall back to internal id)
    const supplierIdent = supplier?.code || supplier?.id || "";
    const finalSupplierUrl =
      supplierUrlTemplate && supplierIdent
        ? fillIdentifier(supplierUrlTemplate, supplierIdent)
        : null;

    // Log supplier redirect event
    try {
      await prisma.supplierRedirectEvent.create({
        data: {
          projectId: redirect.projectId,
          supplierId: redirect.supplierId ?? null,
          respondentId: redirect.respondentId ?? null,
          pid: rid,
          outcome: status, // enum in DB
        },
      });
    } catch {
      // don’t block
    }

    // Build the UI redirect with a `next` param when we have a supplier URL
    const thanksUrl = new URL("/Thanks", url.origin);
    thanksUrl.searchParams.set("status", status);
    thanksUrl.searchParams.set("pid", rid);
    if (finalSupplierUrl) {
      thanksUrl.searchParams.set("next", finalSupplierUrl);
    }

    return NextResponse.redirect(thanksUrl.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}