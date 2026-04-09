export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  const url = new URL(req.url);
  const supplierId = (url.searchParams.get("supplierId") || "").trim();
  const externalId = (url.searchParams.get("id") || "").trim();

  const project = await prisma.project.findFirst({
    where: { OR: [{ id: projectId }, { code: projectId }] },
    select: {
      id: true,
      code: true,
      apiSurveySelection: {
        select: {
          id: true,
        },
      },
      client: {
        select: {
          providerType: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const qs = new URLSearchParams();
  if (supplierId) qs.set("supplierId", supplierId);
  if (externalId) qs.set("id", externalId);

  const isProviderBacked =
    !!project.apiSurveySelection?.id && !!project.client?.providerType;

    // Provider-backed projects still fall through to survey-live for now.
    const targetPath = isProviderBacked
    ? `/api/projects/${encodeURIComponent(project.code || project.id)}/survey-live`
    : `/api/projects/${encodeURIComponent(project.code || project.id)}/survey-live`;

  const target = new URL(targetPath, url.origin);
  for (const [k, v] of qs.entries()) target.searchParams.set(k, v);

  return NextResponse.redirect(target, 302);
}