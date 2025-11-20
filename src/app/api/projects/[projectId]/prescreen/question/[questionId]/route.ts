// FILE: src/app/api/projects/[projectId]/prescreen/question/[questionId]/route.ts

export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const prisma = getPrisma();
  const { questionId } = await ctx.params;
  const b = await req.json();

  const baseData: any = {};
  if (b.title !== undefined) baseData.title = String(b.title);
  if (b.question !== undefined) baseData.question = String(b.question);
  if (b.controlType !== undefined) baseData.controlType = b.controlType;
  if (b.sortOrder !== undefined) baseData.sortOrder = Number(b.sortOrder);
  if (b.text) {
    baseData.textMinLength = b.text.minLength ?? null;
    baseData.textMaxLength = b.text.maxLength ?? null;
    baseData.textType = b.text.textType ?? null;
  }

  try {
    if (Object.keys(baseData).length > 0) {
      await prisma.prescreenQuestion.update({
        where: { id: questionId },
        data: baseData,
      });
    }

    if (Array.isArray(b.options)) {
      const looksLikePatch =
        b.options.length > 0 &&
        typeof b.options[0] === "object" &&
        "optionId" in b.options[0];

      if (looksLikePatch) {
        // patch existing options by id
        await Promise.all(
          b.options.map((o: any) =>
            prisma.prescreenOption.update({
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
        // replace all options (NO createMany → loop create)
        await prisma.prescreenOption.deleteMany({ where: { questionId } });

        for (let i = 0; i < b.options.length; i++) {
          const o = b.options[i];
          await prisma.prescreenOption.create({
            data: {
              questionId,
              label: String(o.label ?? o),
              value: String(o.value ?? o.label ?? o),
              sortOrder:
                o.sortOrder !== undefined && o.sortOrder !== null
                  ? Number(o.sortOrder)
                  : i,
            },
          });
        }
      }
    }

    const updated = await prisma.prescreenQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Update failed", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}

// --- DELETE: remove a question + its options -------------------------------
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; questionId: string }> }
) {
  const prisma = getPrisma();
  const { questionId } = await ctx.params;

  try {
    // remove options first
    await prisma.prescreenOption.deleteMany({ where: { questionId } });
    // then remove the question
    await prisma.prescreenQuestion.delete({ where: { id: questionId } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Delete failed", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}