export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";

const toDecimal = (v: any) =>
  v === undefined || v === null || v === "" ? null : new Prisma.Decimal(v);
const toDate = (v: any) => (v ? new Date(v) : undefined);
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

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

  // optional child
  const rawChild = body.project;
  const hasChild = !!rawChild && !!(rawChild.name || rawChild.projectName);
  const { code: _ignore, ...child } = rawChild || {};

  if (hasChild) {
    if (!child.startDate || !child.endDate || child.projectCpi === undefined) {
      return bad("Child project requires startDate, endDate and projectCpi when provided.");
    }
  }

  try {
    // 1) create group
    const group = await prisma.projectGroup.create({ data: groupData });

    // 2) optionally create 1st project (no transaction)
    let project: { id: string; code: string } | null = null;
    if (hasChild) {
      try {
        const created = await prisma.project.create({
          data: {
            clientId: String(body.clientId),
            groupId: group.id,

            name: child.name ?? child.projectName,
            managerEmail: child.manager ?? child.managerEmail,
            category: child.category ?? "",
            status: (child.status as ProjectStatus) ?? ProjectStatus.ACTIVE,
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
      } catch (e) {
        // best-effort manual rollback to keep things tidy
        try { await prisma.projectGroup.delete({ where: { id: group.id } }); } catch {}
        throw e;
      }
    }

    return NextResponse.json({ group, project }, { status: 201 });
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