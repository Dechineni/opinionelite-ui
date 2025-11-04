// FILE: src/app/api/project-group/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma, ProjectStatus } from "@prisma/client";

/* ----------------------------- small helpers ----------------------------- */

const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

// Accept numbers for Decimal columns (Edge-safe)
const toDecimal = (v: any): number | null =>
  v === undefined || v === null || v === "" ? null : Number(v);

const toDate = (v: any) => (v ? new Date(v) : undefined);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/* ---------------------------------- GET ---------------------------------- */
// GET /api/project-group?q=&clientId=&page=&pageSize=
export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const clientId = searchParams.get("clientId");
    const page = toInt(searchParams.get("page"), 1);
    const pageSize = clamp(toInt(searchParams.get("pageSize"), 10), 1, 100);

    const where: Prisma.ProjectGroupWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } as any },
              { description: { contains: q, mode: "insensitive" } as any },
            ],
          }
        : {}),
      ...(clientId ? { clientId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.projectGroup.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { projects: true } } },
      }),
      prisma.projectGroup.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load project groups", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/* ---------------------------------- POST --------------------------------- */
/**
 * POST /api/project-group
 * Body:
 * {
 *   clientId: string, name: string, description?: string, dynamicThanks?: boolean,
 *   project?: { ...single-project-fields... }   // optional child project
 * }
 */
export async function POST(req: Request) {
  const prisma = getPrisma();
  const body = await req.json();

  if (!body?.clientId || !body?.name) {
    return bad("clientId and name are required for ProjectGroup.");
  }

  const groupData: Prisma.ProjectGroupCreateInput = {
    name: body.name,
    description: body.description ?? null,
    dynamicThanks: !!body.dynamicThanks,
    client: { connect: { id: String(body.clientId) } },
  };

  // If a child project is included, sanitize the payload and ensure required bits
  const rawChild = body.project;
  const hasChild = !!rawChild && !!(rawChild.name || rawChild.projectName);

  // Strip out code if present so DB default sequence generates it
  const { code: _ignoreCode, ...child } = (rawChild ?? {}) as Record<string, any>;

  if (hasChild) {
    if (!child.startDate || !child.endDate || child.projectCpi === undefined) {
      return bad(
        "Child project requires startDate, endDate and projectCpi when provided."
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.projectGroup.create({ data: groupData });

      let project: { id: string; code: string } | null = null;

      if (hasChild) {
        const created = await tx.project.create({
          data: {
            // DO NOT set "code" – DB default handles SR000x generation
            clientId: String(body.clientId),
            groupId: group.id,

            name: child.name ?? child.projectName,
            managerEmail: child.manager ?? child.managerEmail,
            category: child.category ?? "",
            status: (child.status as ProjectStatus) ?? "ACTIVE",

            description: child.description ?? null,
            countryCode: child.country ?? child.countryCode,
            languageCode: child.language ?? child.languageCode,
            currency: child.currency ?? "USD",

            loi: Number(child.loi ?? 0),
            ir: Number(child.ir ?? 0),
            sampleSize: Number(child.sampleSize ?? 0),
            clickQuota: Number(child.clickQuota ?? 0),

            projectCpi: toDecimal(child.projectCpi)!,    // number OK for Decimal
            supplierCpi: toDecimal(child.supplierCpi),

            startDate: toDate(child.startDate)!,
            endDate: toDate(child.endDate)!,

            preScreen: !!child.preScreen,
            exclude: !!child.exclude,
            geoLocation: !!child.geoLocation,
            dynamicThanksUrl: !!child.dynamicThanks || !!child.dynamicThanksUrl,
            uniqueIp: !!child.uniqueIp,
            uniqueIpDepth: child.uniqueIpDepth ? Number(child.uniqueIpDepth) : null,
            tSign: !!child.tSign,
            speeder: !!child.speeder,
            speederDepth: child.speederDepth ? Number(child.speederDepth) : null,
            mobile: !!child.mobile,
            tablet: !!child.tablet,
            desktop: !!child.desktop,
          },
          select: { id: true, code: true },
        });

        project = created;
      }

      return { group, project };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Unique constraint violation.", meta: e.meta },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Create project group failed", detail: String(e) },
      { status: 400 }
    );
  }
}