// FILE: src/app/api/supplier/lite/route.ts
export const runtime = 'edge';
export const preferredRegion = 'auto';
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const prisma = getPrisma();
  const items = await prisma.supplier.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  // Return a plain array so the UI can do .slice()
  return NextResponse.json(items);
}