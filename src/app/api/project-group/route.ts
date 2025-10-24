// FILE: src/app/api/project-group/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

/* ----------------------------- small helpers ----------------------------- */
const toInt = (v: string | null, d: number) =>
  v ? Math.max(1, parseInt(v, 10) || d) : d;

const toDecimal = (v: any) =>
  v === undefined || v === null || v === "" ? null : new Prisma.Decimal(v);

const toDate = (v: any) => (v ? new Date(v) : undefined);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/* ---------------------------------- GET ---------------------------------- */
// GET /api/project-group?q=&clientId=&page=&pageSize=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const clientId = searchParams.get("clientId");
  const page = toInt(searchParams.get("page"), 1);
  const pageSize = toInt(searchParams.get("pageSize"), 10);

  const where: Prisma.ProjectGroupWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
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
  const { code: _ignoreCode, ...child } = rawChild || {};

  // Optional quick validation for child project
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
        // Create the first project for this group
        const created = await tx.project.create({
          data: {
            // DO NOT set "code" – DB default handles SR000x generation
            clientId: String(body.clientId),
            groupId: group.id,

            name: child.name ?? child.projectName,
            managerEmail: child.manager ?? child.managerEmail,
            category: child.category ?? "",
            status:
              (child.status as ProjectStatus) ?? ProjectStatus.ACTIVE,
            description: child.description ?? null,

            countryCode: child.country ?? child.countryCode,
            languageCode: child.language ?? child.languageCode,
            currency: child.currency ?? "USD",

            loi: Number(child.loi ?? 0),
            ir: Number(child.ir ?? 0),
            sampleSize: Number(child.sampleSize ?? 0),
            clickQuota: Number(child.clickQuota ?? 0),

            projectCpi: toDecimal(child.projectCpi)!,
            supplierCpi: toDecimal(child.supplierCpi),

            startDate: toDate(child.startDate)!,
            endDate: toDate(child.endDate)!,

            preScreen: !!child.preScreen,
            exclude: !!child.exclude,
            geoLocation: !!child.geoLocation,
            dynamicThanksUrl:
              !!child.dynamicThanks || !!child.dynamicThanksUrl,
            uniqueIp: !!child.uniqueIp,
            uniqueIpDepth: child.uniqueIpDepth
              ? Number(child.uniqueIpDepth)
              : null,
            tSign: !!child.tSign,
            speeder: !!child.speeder,
            speederDepth: child.speederDepth
              ? Number(child.speederDepth)
              : null,

            mobile: !!child.mobile,
            tablet: !!child.tablet,
            desktop: !!child.desktop,
          },
          // return only what the UI cares about immediately
          select: { id: true, code: true },
        });

        project = created;
      }

      return { group, project };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    // Prisma P2002 means unique constraint (e.g., code) – unlikely now, but handled
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