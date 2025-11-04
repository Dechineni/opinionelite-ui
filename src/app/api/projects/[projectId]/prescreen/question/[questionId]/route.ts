// FILE: src/app/api/projects/[projectId]/prescreen/[questionId]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * GET one prescreen question (with options ordered)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const prisma = getPrisma();
  const { questionId } = await ctx.params;

  const q = await prisma.prescreenQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  if (!q) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(q);
}

/**
 * PATCH a prescreen question.
 * - Updates base fields when provided.
 * - If body.options is:
 *   • array with { optionId?, label?, value?, sortOrder? }
 *     - when optionId present → PATCH existing option(s) (restricted to this question)
 *     - when no optionId present → REPLACE all options from scratch (createMany)
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const prisma = getPrisma();
  const { questionId } = await ctx.params;
  const b = await req.json();

  // Build base updates only from provided fields
  const baseData: Prisma.PrescreenQuestionUpdateInput = {};
  if (b.title !== undefined) baseData.title = String(b.title);
  if (b.question !== undefined) baseData.question = String(b.question);
  if (b.controlType !== undefined) baseData.controlType = b.controlType;
  if (b.sortOrder !== undefined) baseData.sortOrder = Number(b.sortOrder);

  // TEXT-only config (nullable)
  if (b.text) {
    baseData.textMinLength =
      b.text.minLength === undefined ? null : Number(b.text.minLength);
    baseData.textMaxLength =
      b.text.maxLength === undefined ? null : Number(b.text.maxLength);
    baseData.textType = b.text.textType ?? null;
  }

  // Cap the options array to avoid huge payloads burning CPU
  const optionsInput: any[] = Array.isArray(b.options)
    ? (b.options as any[]).slice(0, 200)
    : [];

  await prisma.$transaction(async (tx) => {
    // Update the question base fields if any provided
    if (Object.keys(baseData).length > 0) {
      await tx.prescreenQuestion.update({
        where: { id: questionId },
        data: baseData,
      });
    }

    if (optionsInput.length > 0) {
      const looksLikePatch =
        typeof optionsInput[0] === "object" &&
        optionsInput[0] !== null &&
        "optionId" in optionsInput[0];

      if (looksLikePatch) {
        // PATCH mode: update existing options by ID, but scope to this question
        await Promise.all(
          optionsInput.map((o, i) =>
            tx.prescreenOption.updateMany({
              where: { id: String(o.optionId), questionId },
              data: {
                ...(o.label !== undefined ? { label: String(o.label) } : {}),
                ...(o.value !== undefined ? { value: String(o.value) } : {}),
                ...(o.sortOrder !== undefined
                  ? { sortOrder: Number(o.sortOrder) }
                  : {}),
              },
            })
          )
        );
      } else {
        // REPLACE mode: delete all existing, then createMany
        await tx.prescreenOption.deleteMany({ where: { questionId } });
        // Only keep rows that have at least a label/value
        const rows = optionsInput
          .map((o, i) => ({
            questionId,
            label: String(o?.label ?? o),
            value: String(o?.value ?? o?.label ?? o),
            sortOrder: Number(o?.sortOrder ?? i),
          }))
          .slice(0, 500); // hard cap for safety

        if (rows.length > 0) {
          await tx.prescreenOption.createMany({ data: rows });
        }
      }
    }
  });

  // Return the updated question
  const updated = await prisma.prescreenQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const prisma = getPrisma();
  const { questionId } = await ctx.params;

  // Options are deleted via onDelete: Cascade
  await prisma.prescreenQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}