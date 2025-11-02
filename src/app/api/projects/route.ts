// src/app/api/projects/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

/* ---------- helpers for GET (unchanged) ---------- */

const pageInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

/* ---------- GET /api/projects (updated: adds clientName) ---------- */
export async function GET(req: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const statusParam = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const groupId = searchParams.get("groupId");
  const page = pageInt(searchParams.get("page"), 1);
  const pageSize = pageInt(searchParams.get("pageSize"), 10);

  const where: Prisma.ProjectWhereInput = {
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { managerEmail: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(statusParam && (statusParam in ProjectStatus)
      ? { status: statusParam as ProjectStatus }
      : {}),
    ...(clientId ? { clientId } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const [itemsRaw, total, grouped] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // ⬇️ Pull the client name so the UI can show it
      include: { client: { select: { name: true } } },
    }),
    prisma.project.count({ where }),
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
      where,
    }),
  ]);

  // Flatten client.name -> clientName for the UI (and do not expose the nested `client` object)
  const items = itemsRaw.map(({ client, ...rest }) => ({
    ...rest,
    clientName: client?.name ?? null,
  }));

  const statusCounts = Object.values(ProjectStatus).reduce<Record<ProjectStatus, number>>(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as any
  );
  for (const g of grouped) statusCounts[g.status as ProjectStatus] = g._count._all;

  const flatItems = items.map((p: any) => ({
  ...p,
  clientName: (p as any).client?.name ?? null,
}));
return NextResponse.json({ items: flatItems, total, statusCounts });
}

/* ---------- POST /api/projects (unchanged) ---------- */
export async function POST(req: Request) {
  const prisma = getPrisma();
  const raw = await req.json();

  // strip accidental `code` so DB default is used
  const { code: _ignore, ...b } = raw;

  // Validate required numeric fields (avoid number|undefined)
  const loi = Number(b.loi);
  const ir = Number(b.ir);
  const sampleSize = Number(b.sampleSize);

  if (!Number.isFinite(loi) || !Number.isFinite(ir) || !Number.isFinite(sampleSize)) {
    return NextResponse.json({ error: "Invalid LOI/IR/Sample Size" }, { status: 400 });
  }

  // clickQuota is hidden in UI; default to sampleSize (or 0) if not provided
  const cq =
    b.clickQuota === undefined || b.clickQuota === null || b.clickQuota === ""
      ? sampleSize
      : Number(b.clickQuota);
  if (!Number.isFinite(cq)) {
    return NextResponse.json({ error: "Invalid Click Quota" }, { status: 400 });
  }

  // Decimals
  if (b.projectCpi === undefined || b.projectCpi === null || b.projectCpi === "") {
    return NextResponse.json({ error: "Project CPI is required" }, { status: 400 });
  }
  const projectCpi = new Prisma.Decimal(b.projectCpi);
  const supplierCpi =
    b.supplierCpi === null || b.supplierCpi === undefined || b.supplierCpi === ""
      ? null
      : new Prisma.Decimal(b.supplierCpi);

  // Dates (required by schema)
  if (!b.startDate || !b.endDate) {
    return NextResponse.json({ error: "Start and End dates are required" }, { status: 400 });
  }
  const startDate = new Date(b.startDate);
  const endDate = new Date(b.endDate);
  if (isNaN(+startDate) || isNaN(+endDate)) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  try {
    const created = await prisma.project.create({
      data: {
        clientId: b.clientId,
        groupId: b.groupId ?? null,

        name: b.name ?? b.projectName,
        managerEmail: b.manager ?? b.managerEmail,
        category: b.category ?? "",
        description: b.description ?? null,

        countryCode: b.country ?? b.countryCode,
        languageCode: b.language ?? b.languageCode,
        currency: b.currency ?? "USD",

        // ✅ pass concrete numbers (no union with undefined)
        loi,
        ir,
        sampleSize,
        clickQuota: cq,

        projectCpi,
        supplierCpi,

        // ✅ pass concrete Date
        startDate,
        endDate,

        preScreen: !!b.preScreen,
        exclude: !!b.exclude,
        geoLocation: !!b.geoLocation,
        dynamicThanksUrl:
          typeof b.dynamicThanks === "boolean"
            ? b.dynamicThanks
            : !!b.dynamicThanksUrl,
        uniqueIp: !!b.uniqueIp,
        uniqueIpDepth:
          b.uniqueIpDepth === "" || b.uniqueIpDepth === null || b.uniqueIpDepth === undefined
            ? null
            : Number(b.uniqueIpDepth),
        tSign: !!b.tSign,
        speeder: !!b.speeder,
        speederDepth:
          b.speederDepth === "" || b.speederDepth === null || b.speederDepth === undefined
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
      { error: "Create failed", detail: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}