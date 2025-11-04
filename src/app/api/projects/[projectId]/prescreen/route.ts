// FILE: src/app/api/projects/[projectId]/prescreen/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

// --- helpers ---------------------------------------------------------------
const clampInt = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

async function resolveProjectId(projectIdOrCode: string) {
  const prisma = getPrisma();
  const p = await prisma.project.findFirst({
    where: { OR: [{ id: projectIdOrCode }, { code: projectIdOrCode }] },
    select: { id: true },
  });
  return p?.id ?? null;
}

// --- GET: list questions (ordered) ----------------------------------------
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const projId = await resolveProjectId(projectId);
  if (!projId) {
    // Return empty list instead of 404 so UI can gracefully show "no questions"
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await prisma.prescreenQuestion.findMany({
    where: { projectId: projId },
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ items });
}

// --- POST: create a new question with stable sortOrder ---------------------
/**
 * Body (examples):
 *  TEXT:
 *   { title, question, controlType: "TEXT", text: { minLength?: number, maxLength?: number, textType?: "EMAIL" | "ZIP" | ... } }
 *  SINGLE/MULTI (options):
 *   { title, question, controlType: "SINGLE", options: [{label, value?, sortOrder?}, ...] }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  try {
    const b = await req.json();
    const projId = await resolveProjectId(projectId);
    if (!projId) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const controlType: string = String(b.controlType || "").toUpperCase();
    if (!controlType) {
      return NextResponse.json(
        { error: "controlType is required (e.g., TEXT, SINGLE, MULTI)." },
        { status: 400 }
      );
    }

    // Determine next stable sortOrder (monotonic, non-compacting)
    const agg = await prisma.prescreenQuestion.aggregate({
      where: { projectId: projId },
      _max: { sortOrder: true },
    });
    const nextSort = (agg._max.sortOrder ?? 0) + 1;

    const baseData: any = {
      projectId: projId,
      title: String(b.title ?? ""),
      question: String(b.question ?? ""),
      controlType, // trusted string; Prisma validates at DB layer
      sortOrder: nextSort,
    };

    if (controlType === "TEXT") {
      let min = clampInt(b?.text?.minLength, 0);
      let max =
        b?.text?.maxLength == null ? null : clampInt(b?.text?.maxLength, null as any);
      // if both present and inverted, swap
      if (max != null && min > max) [min, max] = [max, min];

      baseData.textMinLength = min ?? 0;
      baseData.textMaxLength = max;
      baseData.textType = b?.text?.textType ?? null; // Prisma enum checked at DB
    } else {
      // Non-TEXT: accept options; cap to avoid huge payloads on Edge
      const rawOptions: any[] = Array.isArray(b?.options) ? b.options.slice(0, 200) : [];
      // Normalize & ensure at least label/value strings
      const norm = rawOptions.map((o: any, i: number) => ({
        label: String(o?.label ?? o),
        value: String(o?.value ?? o?.label ?? o),
        sortOrder: clampInt(o?.sortOrder, i),
      }));
      baseData.options = { create: norm };
    }

    const created = await prisma.prescreenQuestion.create({
      data: baseData,
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to create prescreen question", detail: String(e?.message ?? e) },
      { status: 400 }
    );
  }
}