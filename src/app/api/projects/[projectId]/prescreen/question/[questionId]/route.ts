// src/app/api/projects/[projectId]/prescreen/question/[questionId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET one prescreen question (with options)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const { questionId } = await ctx.params;

  const q = await prisma.prescreenQuestion.findUnique({
    where: { id: questionId },
    include: { options: true },
  });

  if (!q) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(q);
}

/**
 * PATCH a prescreen question.
 * - Updates base fields (title, question, controlType, sortOrder) and text config when provided.
 * - If body.options is:
 *   - array with { optionId?, label?, value?, sortOrder? }:
 *       • when optionId present → PATCH existing option
 *       • when no optionId present → REPLACE all options from scratch
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const { questionId } = await ctx.params;
  const b = await req.json();

  // Build base updates only from provided fields
  const baseData: any = {};
  if (b.title !== undefined) baseData.title = String(b.title);
  if (b.question !== undefined) baseData.question = String(b.question);
  if (b.controlType !== undefined) baseData.controlType = b.controlType; // enum validated by Prisma
  if (b.sortOrder !== undefined) baseData.sortOrder = Number(b.sortOrder);

  // TEXT-only config (nullable in schema for non-TEXT)
  if (b.text) {
    baseData.textMinLength = b.text.minLength ?? null;
    baseData.textMaxLength = b.text.maxLength ?? null;
    baseData.textType = b.text.textType ?? null; // enum validated by Prisma
  }

  await prisma.$transaction(async (tx) => {
    // Update the question base fields if any provided
    if (Object.keys(baseData).length > 0) {
      await tx.prescreenQuestion.update({
        where: { id: questionId },
        data: baseData,
      });
    }

    // Update options if provided
    if (Array.isArray(b.options)) {
      const looksLikePatch =
        b.options.length > 0 &&
        typeof b.options[0] === "object" &&
        "optionId" in b.options[0];

      if (looksLikePatch) {
        // PATCH mode: update existing options by ID
        await Promise.all(
          b.options.map((o: any, i: number) =>
            tx.prescreenOption.update({
              where: { id: String(o.optionId) },
              data: {
                label: o.label !== undefined ? String(o.label) : undefined,
                value: o.value !== undefined ? String(o.value) : undefined,
                sortOrder:
                  o.sortOrder !== undefined ? Number(o.sortOrder) : undefined,
              },
            })
          )
        );
      } else {
        // REPLACE mode: delete all existing options and recreate
        await tx.prescreenOption.deleteMany({ where: { questionId } });
        if (b.options.length > 0) {
          await tx.prescreenQuestion.update({
            where: { id: questionId },
            data: {
              options: {
                create: b.options.map((o: any, i: number) => ({
                  label: String(o.label ?? o),
                  value: String(o.value ?? o.label ?? o),
                  sortOrder: Number(o.sortOrder ?? i),
                })),
              },
            },
          });
        }
      }
    }
  });

  // Return the updated question
  const updated = await prisma.prescreenQuestion.findUnique({
    where: { id: questionId },
    include: { options: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const { questionId } = await ctx.params;

  // Options are deleted via onDelete: Cascade
  await prisma.prescreenQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}