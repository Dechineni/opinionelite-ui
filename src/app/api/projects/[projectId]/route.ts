// FILE: src/app/api/projects/[projectId]/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { Prisma, ProjectStatus } from "@prisma/client";
import {
  updateSentryProject,
  createSentryProject,
  buildSentryPayload,
  buildSentryUpdatePayload,
} from "@/lib/integrations/sentry";

function whereFrom(req: Request, id: string) {
  const by = new URL(req.url).searchParams.get("by");
  return by === "code" ? { code: id } : { id };
}

// small helpers (Edge/HTTP-safe)
const num = (v: any) =>
  v === undefined ? undefined : v === null ? null : Number(v);

const maybeDate = (v: any) =>
  v === undefined ? undefined : v ? new Date(v) : null;

const decimalNN = (v: any) =>
  v === undefined ? undefined : new Prisma.Decimal(String(v));

const decimalNullable = (v: any) =>
  v === undefined
    ? undefined
    : v === null || v === ""
    ? null
    : new Prisma.Decimal(String(v));

/* ------------------------------- GET ------------------------------- */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;
  const where = whereFrom(req, projectId);

  const item = await prisma.project.findUnique({ where });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

/* ------------------------------ PATCH ------------------------------ */
/**
 * Scalar-only update.
 * No nested writes and no transactions, so it remains Cloudflare/Data Proxy safe.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;
  const where = whereFrom(req, projectId);
  const b = await req.json();
  
  // Prevent Project Type updates
  if ("projectType" in b) {
    return NextResponse.json(
      {
        error: "Project Type cannot be changed after project creation",
      },
      { status: 400 }
    );
  }


  const sentryEnabledWasProvided = typeof b.sentryEnabled === "boolean";
  const sentryWillBeEnabled = b.sentryEnabled === true;

  const sentryProviderId =
    typeof b.sentryProviderId === "string" && b.sentryProviderId.trim()
      ? b.sentryProviderId.trim()
      : process.env.SENTRY_PROVIDER_ID?.trim() || undefined;

  const sentryIdField =
    typeof b.sentryIdField === "string" && b.sentryIdField.trim()
      ? b.sentryIdField.trim()
      : process.env.SENTRY_ID_FIELD?.trim() || "aid";

  const data: Prisma.ProjectUncheckedUpdateInput = {
    // code / basic fields
    code: b.code,
    name: b.name ?? b.projectName,
    managerEmail: b.manager ?? b.managerEmail,
    category: b.category,
    status: (b.status as ProjectStatus) ?? undefined,
    description: b.description ?? (b.description === null ? null : undefined),

    // set FK columns directly
    clientId:
      b.clientId === undefined ? undefined : String(b.clientId),
    groupId:
      b.groupId === undefined
        ? undefined
        : b.groupId === null
        ? null
        : String(b.groupId),

    // locales / currency
    countryCode: b.country ?? b.countryCode,
    languageCode: b.language ?? b.languageCode,
    currency: b.currency,

    // numbers
    loi: num(b.loi) as any,
    ir: num(b.ir) as any,
    sampleSize: num(b.sampleSize) as any,
    clickQuota: num(b.clickQuota) as any,

    // decimals
    projectCpi: decimalNN(b.projectCpi) as any,
    supplierCpi: decimalNullable(b.supplierCpi) as any,

    // dates
    startDate: maybeDate(b.startDate) as any,
    endDate: maybeDate(b.endDate) as any,

    // booleans
    preScreen: typeof b.preScreen === "boolean" ? b.preScreen : undefined,
    exclude: typeof b.exclude === "boolean" ? b.exclude : undefined,
    geoLocation:
      typeof b.geoLocation === "boolean" ? b.geoLocation : undefined,
    dynamicThanksUrl:
      typeof b.dynamicThanks === "boolean"
        ? b.dynamicThanks
        : typeof b.dynamicThanksUrl === "boolean"
        ? b.dynamicThanksUrl
        : undefined,
    uniqueIp: typeof b.uniqueIp === "boolean" ? b.uniqueIp : undefined,
    uniqueIpDepth:
      b.uniqueIpDepth === undefined
        ? undefined
        : b.uniqueIpDepth === null || b.uniqueIpDepth === ""
        ? null
        : Number(b.uniqueIpDepth),
    tSign: typeof b.tSign === "boolean" ? b.tSign : undefined,
    speeder: typeof b.speeder === "boolean" ? b.speeder : undefined,
    speederDepth:
      b.speederDepth === undefined
        ? undefined
        : b.speederDepth === null || b.speederDepth === ""
        ? null
        : Number(b.speederDepth),
    mobile: typeof b.mobile === "boolean" ? b.mobile : undefined,
    tablet: typeof b.tablet === "boolean" ? b.tablet : undefined,
    desktop: typeof b.desktop === "boolean" ? b.desktop : undefined,

    // Sentry enabled flag
    sentryEnabled: sentryEnabledWasProvided ? sentryWillBeEnabled : undefined,

    // Sentry config
    ...(sentryEnabledWasProvided && sentryWillBeEnabled
      ? {
          sentryTemplateId: b.sentryTemplateId ?? null,

          sentryProviderId,
          sentryIdField,

          sentryHashingEnabled: b.sentryHashingEnabled ?? false,
          sentryVerisoulEnabled: b.sentryVerisoulEnabled ?? false,
          sentryVerisoulTermFake: b.sentryVerisoulTermFake ?? false,
          sentryVerisoulTermSuspicious:
            b.sentryVerisoulTermSuspicious ?? false,
        }
      : {}),

    // If Sentry is explicitly disabled, clear all Sentry fields.
    ...(sentryEnabledWasProvided && !sentryWillBeEnabled
      ? {
          sentryProjectId: null,
          sentryTemplateId: null,
          sentryProviderId: null,
          sentryIdField: null,
          sentryLiveUrl: null,
          sentryTestUrl: null,
          sentryReportingUrl: null,
          sentryProjectStatus: null,
          sentryHashingEnabled: false,
          sentryVerisoulEnabled: false,
          sentryVerisoulTermFake: false,
          sentryVerisoulTermSuspicious: false,
        }
      : {}),
  };

  try {
    const updated = await prisma.project.update({ where, data });

    /* ---------------- SENTRY SYNC (EDIT FLOW) ---------------- */
    try {
      if (updated.sentryEnabled) {
        let sentryResponse;

        if (updated.sentryProjectId) {
          // Update existing Sentry project.
          // This will push corrected clientUrl/terminationUrl/testClientUrl/addStatusToUrl.
          const payload = buildSentryUpdatePayload(updated);

          sentryResponse = await updateSentryProject(
            updated.sentryProjectId,
            payload
          );
        } else {
          // Create Sentry project if enabled but not created yet.
          const payload = buildSentryPayload(updated);

          sentryResponse = await createSentryProject(payload);
        }

        const sentryProject = sentryResponse?.project;

        if (sentryProject?.projectId) {
          await prisma.project.update({
            where,
            data: {
              sentryProjectId: sentryProject.projectId,
              sentryLiveUrl: sentryProject.liveUrl,
              sentryTestUrl: sentryProject.testUrl,
              sentryReportingUrl: sentryProject.projectReportingUrl,
              sentryProjectStatus: sentryProject.projectStatus,
            },
          });
        }
      }
    } catch (err) {
      console.error("❌ Sentry sync failed (edit flow):", err);
      // Do not fail the main project update.
    }

    const refreshed = await prisma.project.findUnique({ where });

    return NextResponse.json(refreshed ?? updated);
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Update failed",
        detail: String(e?.message ?? e),
      },
      { status: 400 }
    );
  }
}

/* ----------------------------- DELETE ------------------------------ */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const prisma = getPrisma();
  const { projectId } = await ctx.params;

  try {
    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Delete failed", detail: String(e) },
      { status: 400 }
    );
  }
}