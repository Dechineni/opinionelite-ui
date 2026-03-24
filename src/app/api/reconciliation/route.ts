//src/app/api/reconciliation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';

async function resolveSupplierBySurveyRedirectCodeOrId(supplierRef: string | null | undefined) {
  if (!supplierRef) return null;

  let supplier = await prisma.supplier.findUnique({
    where: { id: supplierRef },
    select: { id: true, code: true, name: true },
  });

  if (!supplier) {
    supplier = await prisma.supplier.findUnique({
      where: { code: supplierRef },
      select: { id: true, code: true, name: true },
    });
  }

  return supplier;
}

async function creditOpPanelReward(args: {
  signupId: string;
  pid: string;
  projectCode: string;
  projectName: string;
  supplierCode: string;
  supplierName: string;
  rewardAmount: number;
}) {
  const opPanelBase = (process.env.OP_PANEL_API_BASE || '').trim();
  const opPanelKey = (process.env.OP_PANEL_PROFILE_API_KEY || '').trim();

  if (!opPanelBase || !opPanelKey) {
    console.warn('[reconciliation] OP Panel reward credit skipped: missing env', {
      hasBase: Boolean(opPanelBase),
      hasKey: Boolean(opPanelKey),
    });
    return { ok: false as const, skipped: true as const, reason: 'missing-env' };
  }

  const endpoint = `${opPanelBase.replace(/\/$/, '')}/UI/reconcile_reward.php`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opPanelKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      signup_id: args.signupId,
      pid: args.pid,
      project_code: args.projectCode,
      project_name: args.projectName,
      supplier_code: args.supplierCode,
      supplier_name: args.supplierName,
      reward_amount: args.rewardAmount,
    }),
    cache: 'no-store',
  });

  const text = await res.text().catch(() => '');
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    console.error('[reconciliation] OP Panel reward credit failed', {
      status: res.status,
      body,
    });
    return { ok: false as const, status: res.status, body };
  }

  return { ok: true as const, body };
}
 
// POST /api/reconciliation
export async function POST(req: NextRequest) {
  try {
    const { searchIdentifier, action } = await req.json();
    if (!searchIdentifier) {
      return NextResponse.json({ error: 'Missing searchIdentifier' }, { status: 400 });
    }
 
    // Find SurveyRedirect by SearchIdentifier (RespondentId) and filter by result
    const surveyRedirect = await prisma.surveyRedirect.findFirst({
      where: {
        respondentId: searchIdentifier,
        result: {
          in: ['COMPLETE', 'TERMINATE'],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        projectId: true,
        supplierId: true,
        respondentId: true,
        externalId: true,
        result: true,
      },
    });
   
    if (!surveyRedirect) {
      return NextResponse.json({ error: 'SurveyRedirect not found or not eligible' }, { status: 404 });
    }
 
    // Load project data as required (by id)
    const project = await prisma.project.findUnique({
      where: { id: surveyRedirect.projectId },
      select: { id: true, code: true, name: true },
    });
 
    const supplier = await resolveSupplierBySurveyRedirectCodeOrId(surveyRedirect.supplierId);

    // Return the values, using result from SurveyRedirect only
    // Set status label based on result
    let statusLabel = 'Status';
    if (surveyRedirect.result === 'COMPLETE') statusLabel = 'Complete';
    else if (surveyRedirect.result === 'TERMINATE') statusLabel = 'Quality Terminate';
 
    // When explicitly reconciling, persist to Reconciliation table.
    // Any failure here should NOT break the response used by the UI.
    if (action === 'reconcile' && surveyRedirect.respondentId && project && supplier?.id) {
      try {
        let outcome: any = null;
        if (surveyRedirect.result === 'COMPLETE') {
          outcome = 'COMPLETE';
        } else if (surveyRedirect.result === 'TERMINATE') {
          outcome = 'TERMINATE';
        }
 
        console.log('Before upsert - respondentId:', surveyRedirect.respondentId, 'outcome:', outcome, 'supplierId:', supplier?.id);
         
        await prisma.reconciliation.upsert({
         where: { respondentId: surveyRedirect.respondentId },
          create: {
           respondentId: surveyRedirect.respondentId,
           projectId: project.id,
           supplierId: supplier.id,
           projectCode: project.code,
           projectName: project.name,
           supplierName: supplier.name,
           supplierIdentifier: supplier.code ?? surveyRedirect.supplierId ?? '',
           outcome: outcome,
           lastEventAt: new Date(),
         },
         update: {
           projectId: project.id,
           supplierId: supplier.id,
           projectCode: project.code,
           projectName: project.name,
           supplierName: supplier.name,
           supplierIdentifier: supplier.code ?? surveyRedirect.supplierId ?? '',
           outcome: outcome,
           lastEventAt: new Date(),
         },
        });
        console.log('After upsert - respondentId:', surveyRedirect.respondentId, 'successfully persisted to reconciliation table');

        if (surveyRedirect.result === 'COMPLETE' && surveyRedirect.externalId) {
          const map = await prisma.projectSupplierMap.findUnique({
            where: {
              projectId_supplierId: {
                projectId: project.id,
                supplierId: supplier.id,
              },
            },
            select: { cpi: true },
          });

          const rewardAmount = Number(map?.cpi ?? 0);
          if (rewardAmount > 0) {
            await creditOpPanelReward({
              signupId: String(surveyRedirect.externalId),
              pid: surveyRedirect.id,
              projectCode: project.code,
              projectName: project.name,
              supplierCode: supplier.code,
              supplierName: supplier.name,
              rewardAmount,
            });
          } else {
            console.warn('[reconciliation] reward credit skipped: invalid CPI', {
              pid: surveyRedirect.id,
              projectId: project.id,
              supplierId: supplier.id,
              rewardAmount,
            });
          }
        }
      } catch (writeError) {
        console.error(
          'Failed to upsert reconciliation record',
          writeError,
        );
      }
    }
 
    return NextResponse.json({
      projectCode: project?.code || null,
      projectName: project?.name || null,
      supplier: supplier?.name || null,
      supplierIdentifier: supplier?.code || surveyRedirect.supplierId || null,
      userIdentifier: surveyRedirect.respondentId,
      status: statusLabel,
      outcome: surveyRedirect.result || null,
    });
  } catch (error) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? (error as any).message
        : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    );
  }
}