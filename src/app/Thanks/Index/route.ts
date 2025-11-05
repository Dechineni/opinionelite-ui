// FILE: src/app/Thanks/Index/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

/** Map auth → status (accept short and numeric codes) */
function authToStatus(authRaw: string | null | undefined) {
  const a = (authRaw || '').toLowerCase().trim();
  if (a === 'c') return 'COMPLETE' as const;
  if (a === 't') return 'TERMINATE' as const;
  if (a === 'q') return 'OVER_QUOTA' as const;
  if (a === 'f') return 'QUALITY_TERM' as const;
  if (a === 'sc') return 'SURVEY_CLOSE' as const;
  switch (a) {
    case '10': return 'COMPLETE';
    case '20': return 'TERMINATE';
    case '30': return 'QUALITY_TERM';
    case '40': return 'OVER_QUOTA';
    case '70': return 'SURVEY_CLOSE';
    default:   return null;
  }
}

/** Replace [identifier] or id/rid=identifier in supplier URLs */
function fillIdentifier(rawUrl: string, supplierIdentifier: string) {
  try {
    const u = new URL(rawUrl);
    // Replace any query value that literally contains [identifier]
    u.searchParams.forEach((v, k) => {
      if (/\[identifier\]/i.test(v)) {
        u.searchParams.set(k, v.replace(/\[identifier\]/gi, supplierIdentifier));
      }
      if (['id', 'rid'].includes(k.toLowerCase()) && v.toLowerCase() === 'identifier') {
        u.searchParams.set(k, supplierIdentifier);
      }
    });
    let out = u.toString();
    out = out.replace(/\[identifier\]/gi, supplierIdentifier);
    return out;
  } catch {
    // If invalid URL, do a best-effort string replace
    return rawUrl
      .replace(/\[identifier\]/gi, supplierIdentifier)
      .replace(/([?&])(id|rid)=identifier/gi, `$1$2=${supplierIdentifier}`);
  }
}

// Map outcome → the single supplier URL column we need
const fieldMap = {
  COMPLETE: 'completeUrl',
  TERMINATE: 'terminateUrl',
  OVER_QUOTA: 'overQuotaUrl',
  QUALITY_TERM: 'qualityTermUrl',
  SURVEY_CLOSE: 'surveyCloseUrl',
} as const;
type Outcome = keyof typeof fieldMap;
type SupplierUrlKey = (typeof fieldMap)[Outcome];

export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const url = new URL(req.url);
    const auth = (url.searchParams.get('auth') || '').trim();
    const rid  = (url.searchParams.get('rid')  || '').trim();

    const status = authToStatus(auth);
    if (!status) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or missing auth' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!rid) {
      return NextResponse.json(
        { ok: false, error: 'Missing rid' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Find the original redirect (projectId, supplierId, respondentId)
    const redirect = await prisma.surveyRedirect.findUnique({
      where: { id: rid },
      select: { projectId: true, supplierId: true, respondentId: true },
    });

    // If we can't find the redirect, still show Thank You page (don’t block)
    if (!redirect) {
      const fallback = new URL('/Thanks', url.origin);
      fallback.searchParams.set('status', status);
      fallback.searchParams.set('pid', rid);
      return NextResponse.redirect(fallback.toString(), { status: 303 });
    }

    // If we have a supplier, fetch ONLY the one URL we need plus identifiers
    let finalSupplierUrl: string | null = null;
    if (redirect.supplierId) {
      const key: SupplierUrlKey = fieldMap[status];
      // Build a minimal dynamic select
      const select: Record<string, true> = { id: true, code: true };
      select[key] = true;

      const supplier = await prisma.supplier.findUnique({
        where: { id: redirect.supplierId },
        select: select as any,
      });

      if (supplier) {
        const supplierIdent = (supplier as any).code || (supplier as any).id || '';
        const template = (supplier as any)[key] as string | null | undefined;
        if (template && supplierIdent) {
          finalSupplierUrl = fillIdentifier(template, String(supplierIdent));
        }
      }
    }

    // Prepare the user-facing Thank You redirect (fast path)
    const thanksUrl = new URL('/Thanks', url.origin);
    thanksUrl.searchParams.set('status', status);
    thanksUrl.searchParams.set('pid', rid);
    if (finalSupplierUrl) thanksUrl.searchParams.set('next', finalSupplierUrl);

    const res = NextResponse.redirect(thanksUrl.toString(), { status: 303 });

    // Fire-and-forget: log the supplier outcome (don’t block the redirect)
    prisma.supplierRedirectEvent.create({
      data: {
        projectId: redirect.projectId,
        supplierId: redirect.supplierId ?? null,
        respondentId: redirect.respondentId ?? null,
        pid: rid,
        outcome: status, // enum
      },
    }).catch(() => { /* ignore logging errors */ });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}