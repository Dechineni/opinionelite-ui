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
 *   { title, question, controlType: "TEXT", text: { minLength?: number, maxLength?: number, textType?: "EMAIL" | "ZIPCODE" | "CONTACTNO" | "CUSTOM" } }
 *  SINGLE/MULTI (options):
 *   { title, question, controlType: "RADIO" | "DROPDOWN" | "CHECKBOX", options: [{label, value?, sortOrder?}, ...] }
 *
 * NOTE (Workers + Prisma HTTP driver):
 *   We must avoid any operations that internally use transactions (like createMany
 *   with special flags). So we:
 *   1) create PrescreenQuestion
 *   2) loop and create PrescreenOption rows one-by-one.
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
        { error: "controlType is required (TEXT, RADIO, DROPDOWN, CHECKBOX)." },
        { status: 400 }
      );
    }

    // Determine next stable sortOrder (monotonic, non-compacting)
    const agg = await prisma.prescreenQuestion.aggregate({
      where: { projectId: projId },
      _max: { sortOrder: true },
    });
    const nextSort = (agg._max.sortOrder ?? 0) + 1;

    // Base question data
    const baseData: any = {
      projectId: projId,
      title: String(b.title ?? ""),
      question: String(b.question ?? ""),
      controlType,
      sortOrder: nextSort,
    };

    // TEXT config
    if (controlType === "TEXT") {
      let min = clampInt(b?.text?.minLength, 0);
      let max =
        b?.text?.maxLength == null ? null : clampInt(b?.text?.maxLength, null as any);
      if (max != null && min > max) [min, max] = [max, min];

      baseData.textMinLength = min ?? 0;
      baseData.textMaxLength = max;
      baseData.textType = b?.text?.textType ?? null; // Prisma enum validates
    }

    // 1) Create the question FIRST
    const createdQ = await prisma.prescreenQuestion.create({
      data: baseData,
      select: { id: true },
    });

    // 2) If non-TEXT, create options one-by-one (NO createMany → NO tx)
    if (controlType !== "TEXT") {
      const rawOptions: any[] = Array.isArray(b?.options) ? b.options.slice(0, 200) : [];

      for (let i = 0; i < rawOptions.length; i++) {
        const o = rawOptions[i];
        await prisma.prescreenOption.create({
          data: {
            questionId: createdQ.id,
            label: String(o?.label ?? o),
            value: String(o?.value ?? o?.label ?? o),
            sortOrder: clampInt(o?.sortOrder, i),
          },
        });
      }
    }

    // Return with full object (include options)
    const createdFull = await prisma.prescreenQuestion.findUnique({
      where: { id: createdQ.id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(createdFull, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const hint = msg.includes("Transactions are not supported")
      ? " (Prisma HTTP driver does not support transactional writes; we avoid createMany/tx.)"
      : "";
    return NextResponse.json(
      { error: "Failed to create prescreen question" + hint, detail: msg },
      { status: 400 }
    );
  }
}