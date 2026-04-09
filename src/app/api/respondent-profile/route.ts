export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

function normalizeGender(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v === "male") return "Male";
  if (v === "female") return "Female";
  return null;
}

export async function POST(req: Request) {
  const prisma = getPrisma();

  try {
    const body = await req.json();

    const projectId = String(body?.projectId || "").trim();
    const supplierIdRaw = String(body?.supplierId || "").trim();
    const supplierId = supplierIdRaw || null;
    const externalId = String(body?.externalId || "").trim();
    const birthDateRaw = String(body?.birthDate || "").trim();
    const genderRaw = String(body?.gender || "").trim();
    const next = String(body?.next || "").trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (!externalId) {
      return NextResponse.json({ error: "Respondent id is required." }, { status: 400 });
    }

    if (!isValidDateOnly(birthDateRaw)) {
      return NextResponse.json({ error: "Valid date of birth is required." }, { status: 400 });
    }

    const gender = normalizeGender(genderRaw);
    if (!gender) {
      return NextResponse.json({ error: "Valid gender is required." }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { OR: [{ id: projectId }, { code: projectId }] },
      select: { id: true, code: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const birthDate = new Date(`${birthDateRaw}T00:00:00.000Z`);

    if (supplierId) {
  await prisma.respondentLaunchProfile.upsert({
    where: {
      projectId_supplierId_externalId: {
        projectId: project.id,
        supplierId,
        externalId,
      },
    },
    update: {
      birthDate,
      gender,
    },
    create: {
      projectId: project.id,
      supplierId,
      externalId,
      birthDate,
      gender,
    },
  });
} else {
  const existing = await prisma.respondentLaunchProfile.findFirst({
    where: {
      projectId: project.id,
      supplierId: null,
      externalId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.respondentLaunchProfile.update({
      where: { id: existing.id },
      data: {
        birthDate,
        gender,
      },
    });
  } else {
    await prisma.respondentLaunchProfile.create({
      data: {
        projectId: project.id,
        supplierId: null,
        externalId,
        birthDate,
        gender,
      },
    });
  }
}

    const qs = new URLSearchParams();
    if (supplierId) qs.set("supplierId", supplierId);
    qs.set("id", externalId);

    const projectKey = project.code || project.id;
    const fallbackPath = `/api/projects/${encodeURIComponent(projectKey)}/launch`;
    const redirectPath = next || `${fallbackPath}?${qs.toString()}`;

    return NextResponse.json({
      ok: true,
      redirectUrl: redirectPath,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save respondent profile." },
      { status: 500 }
    );
  }
}