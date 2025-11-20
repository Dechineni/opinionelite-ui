// src/app/api/projects/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { Prisma, ProjectStatus, RedirectOutcome } from '@prisma/client';

/* ----------------------------- helpers ----------------------------- */

const pageInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const normalizeStatus = (s: string | null): ProjectStatus | undefined => {
  if (!s) return undefined;
  const up = s.toUpperCase() as ProjectStatus;
  return (Object.values(ProjectStatus) as string[]).includes(up) ? up : undefined;
};

/* ------------------------------- GET ------------------------------- */
// GET /api/projects?q=&status=&clientId=&groupId=&page=&pageSize=
export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);

  const q        = (searchParams.get('q') ?? '').trim();
  const status   = normalizeStatus(searchParams.get('status'));
  const clientId = searchParams.get('clientId');
  const groupId  = searchParams.get('groupId');
  const page     = pageInt(searchParams.get('page'), 1);
  const pageSize = pageInt(searchParams.get('pageSize'), 10);

  const where: Prisma.ProjectWhereInput = {
    ...(q
      ? {
          OR: [
            { code:         { contains: q, mode: Prisma.QueryMode.insensitive } },
            { name:         { contains: q, mode: Prisma.QueryMode.insensitive } },
            { managerEmail: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(groupId ? { groupId } : {}),
  };

  // 1) Base project list + total + status buckets
  const [itemsRaw, total, grouped] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // only pull what UI needs + client.name
      include: { client: { select: { name: true } } },
    }),
    prisma.project.count({ where }),
    prisma.project.groupBy({
      by: ['status'],
      _count: { _all: true },
      where,
    }),
  ]);

  // 2) Aggregate redirect outcomes (C/T/Q/D) per project
  const projectIds = itemsRaw.map((p) => p.id);

  let outcomeGrouped: { projectId: string; outcome: RedirectOutcome; _count: { _all: number } }[] =
    [];

  if (projectIds.length > 0) {
    // TypeScript is a bit strict on groupBy generics, so we cast the result.
    const groupedOutcomes = await prisma.supplierRedirectEvent.groupBy({
      by: ['projectId', 'outcome'] as const,
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    });

    outcomeGrouped = groupedOutcomes as typeof outcomeGrouped;
  }

  // Build map: projectId -> { c, t, q, d }
  const byProject: Record<string, { c: number; t: number; q: number; d: number }> = {};
  for (const g of outcomeGrouped) {
    const bucket = (byProject[g.projectId] ??= { c: 0, t: 0, q: 0, d: 0 });
    switch (g.outcome) {
      case 'COMPLETE':
        bucket.c += g._count._all;
        break;
      case 'TERMINATE':
        bucket.t += g._count._all;
        break;
      case 'OVER_QUOTA':
        bucket.q += g._count._all;
        break;
      case 'DROP_OUT':
        bucket.d += g._count._all;
        break;
      default:
        // QUALITY_TERM / SURVEY_CLOSE are not displayed in ProjectList
        break;
    }
  }

  // 3) Flatten client name once & attach C/T/Q/D totals
  const items = itemsRaw.map(({ client, ...rest }) => {
    const totals = byProject[rest.id] ?? { c: 0, t: 0, q: 0, d: 0 };
    return {
      ...rest,
      clientName: client?.name ?? null,
      c: totals.c,
      t: totals.t,
      q: totals.q,
      d: totals.d,
    };
  });

  // 4) Build status buckets
  const statusCounts = Object.values(ProjectStatus).reduce<Record<ProjectStatus, number>>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );
  for (const g of grouped) statusCounts[g.status as ProjectStatus] = g._count._all;

  return NextResponse.json({ items, total, statusCounts });
}

/* ------------------------------- POST ------------------------------ */
// Create project (server validates numbers/decimals/dates)
export async function POST(req: Request) {
  const prisma = getPrisma();
  const raw = await req.json();

  // strip accidental `code` so DB default is used
  const { code: _ignore, ...b } = raw;

  // Validate required numeric fields
  const loi = Number(b.loi);
  const ir = Number(b.ir);
  const sampleSize = Number(b.sampleSize);
  if (![loi, ir, sampleSize].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Invalid LOI/IR/Sample Size' }, { status: 400 });
  }

  // clickQuota defaults to sampleSize when omitted
  const clickQuota =
    b.clickQuota === undefined || b.clickQuota === null || b.clickQuota === ''
      ? sampleSize
      : Number(b.clickQuota);
  if (!Number.isFinite(clickQuota)) {
    return NextResponse.json({ error: 'Invalid Click Quota' }, { status: 400 });
  }

  // Decimals
  if (b.projectCpi === undefined || b.projectCpi === null || b.projectCpi === '') {
    return NextResponse.json({ error: 'Project CPI is required' }, { status: 400 });
  }
  const projectCpi = new Prisma.Decimal(b.projectCpi);
  const supplierCpi =
    b.supplierCpi === null || b.supplierCpi === undefined || b.supplierCpi === ''
      ? null
      : new Prisma.Decimal(b.supplierCpi);

  // Dates
  if (!b.startDate || !b.endDate) {
    return NextResponse.json({ error: 'Start and End dates are required' }, { status: 400 });
  }
  const startDate = new Date(b.startDate);
  const endDate = new Date(b.endDate);
  if (isNaN(+startDate) || isNaN(+endDate)) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
  }

  try {
    const created = await prisma.project.create({
      data: {
        clientId: b.clientId,
        groupId: b.groupId ?? null,

        name: b.name ?? b.projectName,
        managerEmail: b.manager ?? b.managerEmail,
        category: b.category ?? '',
        description: b.description ?? null,

        countryCode: b.country ?? b.countryCode,
        languageCode: b.language ?? b.languageCode,
        currency: b.currency ?? 'USD',

        loi,
        ir,
        sampleSize,
        clickQuota,

        projectCpi,
        supplierCpi,

        startDate,
        endDate,

        preScreen: !!b.preScreen,
        exclude: !!b.exclude,
        geoLocation: !!b.geoLocation,
        dynamicThanksUrl:
          typeof b.dynamicThanks === 'boolean'
            ? b.dynamicThanks
            : !!b.dynamicThanksUrl,
        uniqueIp: !!b.uniqueIp,
        uniqueIpDepth:
          b.uniqueIpDepth === '' || b.uniqueIpDepth === null || b.uniqueIpDepth === undefined
            ? null
            : Number(b.uniqueIpDepth),
        tSign: !!b.tSign,
        speeder: !!b.speeder,
        speederDepth:
          b.speederDepth === '' || b.speederDepth === null || b.speederDepth === undefined
            ? null
            : Number(b.speederDepth),

        mobile: !!b.mobile,
        tablet: !!b.tablet,
        desktop: !!b.desktop,
      },
      select: { id: true, code: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Create failed', detail: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}