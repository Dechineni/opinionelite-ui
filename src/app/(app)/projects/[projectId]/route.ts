import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  context:{ params: Promise<{ projectId: string }> }
) {
  try {
    const prisma = getPrisma();
    const { projectId } = await context.params;
    const body = await req.json();

    const validStatuses = [
  "ACTIVE",
  "INACTIVE",
  "CLOSED",
  "INVOICED",
  "BID",
];

if (!validStatuses.includes(body.status)) {
  return NextResponse.json(
    { error: `Invalid status: ${body.status}` },
    { status: 400 }
  );
}


    await prisma.project.update({
      where: { id: projectId },
      data: { status: body.status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("STATUS UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update project status" },
      { status: 500 }
    );
  }
}
