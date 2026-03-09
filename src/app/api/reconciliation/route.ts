//src/app/api/reconciliation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';
 
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
          in: ["COMPLETE", "TERMINATE"],
        },
      },
    });
   
    if (!surveyRedirect) {
      return NextResponse.json({ error: 'SurveyRedirect not found or not eligible' }, { status: 404 });
    }
 
    // Load project data as required (by id)
    const project = await prisma.project.findUnique({
      where: { id: surveyRedirect.projectId },
    });
 
    // Load supplier data as required (by code)
    let supplier = null;
    if (surveyRedirect.supplierId) {
      supplier = await prisma.supplier.findUnique({
        where: { code: surveyRedirect.supplierId },
      });
    }
 
    // Return the values, using result from SurveyRedirect only
    // Set status label based on result
    let statusLabel = 'Status';
    if (surveyRedirect.result === 'COMPLETE') statusLabel = 'Complete';
    else if (surveyRedirect.result === 'TERMINATE') statusLabel = 'Quality Terminate';
 
    // When explicitly reconciling, persist to Reconciliation table.
    // Any failure here should NOT break the response used by the UI.
    if (
      action === 'reconcile' && surveyRedirect.respondentId && project
    ) {
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
           supplierId: supplier?.id as any,
           projectCode: project.code,
           projectName: project.name,
           supplierName: supplier?.name as any,
           supplierIdentifier: supplier?.code ?? surveyRedirect.supplierId ?? '',
           outcome: outcome,
           lastEventAt: new Date(),
         },
         update: {
           projectId: project.id,
           supplierId: supplier?.id as any,
           projectCode: project.code,
           projectName: project.name,
           supplierName: supplier?.name as any,
           supplierIdentifier: supplier?.code ?? surveyRedirect.supplierId ?? '',
           outcome: outcome,
           lastEventAt: new Date(),
         },
        });
        console.log('After upsert - respondentId:', surveyRedirect.respondentId, 'successfully persisted to reconciliation table');
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