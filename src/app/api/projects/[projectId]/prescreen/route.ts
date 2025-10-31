// src/app/api/projects/[projectId]/prescreen/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrescreenControlType, PrescreenTextType } from "@prisma/client";

/**
 * GET: list prescreen questions for a project (projectId in URL can be DB id or code like "SR0004")
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params; // can be DB id or code

  // Resolve to actual project row
  const project =
    (await prisma.project.findUnique({ where: { id: projectId } })) ??
    (await prisma.project.findUnique({ where: { code: projectId } }));

  if (!project) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await prisma.prescreenQuestion.findMany({
    where: { projectId: project.id },
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ items });
}

/**
 * POST: create a new prescreen question with a STABLE sortOrder.
 * - Ignores any client-provided sortOrder and assigns max(sortOrder)+1 for this project.
 * - Accepts project id OR project code in the URL.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const b = await req.json();

  // Resolve project (id or code)
  const project =
    (await prisma.project.findUnique({ where: { id: projectId } })) ??
    (await prisma.project.findUnique({ where: { code: projectId } }));

  if (!project) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  // Determine next stable sortOrder (monotonic, never compact)
  const agg = await prisma.prescreenQuestion.aggregate({
    where: { projectId: project.id },
    _max: { sortOrder: true },
  });
  const nextSort = (agg._max.sortOrder ?? 0) + 1;

  // Base payload
  const data: any = {
    projectId: project.id,
    title: String(b.title || ""),
    question: String(b.question || ""),
    controlType: b.controlType as PrescreenControlType,
    sortOrder: nextSort, // 👈 stable, server-assigned
  };

  // TEXT configuration
  if (data.controlType === "TEXT") {
    data.textMinLength = Number(b.text?.minLength ?? 0);
    data.textMaxLength = b.text?.maxLength == null ? null : Number(b.text.maxLength);
    data.textType = (b.text?.textType ?? null) as PrescreenTextType | null;
  }
  // OPTIONS configuration
  else if (Array.isArray(b.options)) {
    data.options = {
      create: b.options.map((o: any, i: number) => ({
        label: String(o?.label ?? o),
        value: String(o?.value ?? o?.label ?? o),
        sortOrder: Number(o?.sortOrder ?? i),
      })),
    };
  }

  const created = await prisma.prescreenQuestion.create({
    data,
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(created, { status: 201 });
}