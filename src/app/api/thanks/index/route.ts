// FILE: src/app/api/thanks/index/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Normalize required params
  const auth = (url.searchParams.get('auth') || '').trim();
  const rid  = (url.searchParams.get('rid')  || '').trim();

  if (!auth || !rid) {
    return NextResponse.json(
      { ok: false, error: 'Missing auth or rid' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Mirror to the canonical handler that does the work
  // (Keep the path’s original casing if your page route expects it)
  const target = new URL('/Thanks/Index', url.origin);

  // Pass through _all_ query params unchanged
  // (this re-encodes safely and prevents duplicated keys)
  for (const [k, v] of url.searchParams.entries()) {
    target.searchParams.set(k, v);
  }

  // 303 is explicit “See Other”, commonly better for API → page redirects
  return NextResponse.redirect(target.toString(), { status: 303 });
}