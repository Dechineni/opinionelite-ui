export const runtime = "edge";
export const preferredRegion = "auto";

import { handleProviderNotification } from "../../_core";

type Ctx = {
  params: Promise<{
    provider: string;
    event: string;
  }>;
};

export async function POST(req: Request, ctx: Ctx) {
  const { provider, event } = await ctx.params;
  return handleProviderNotification({ provider, event: event as any, req });
}

export async function GET(req: Request, ctx: Ctx) {
  // Some providers send GET callbacks; support it.
  const { provider, event } = await ctx.params;
  return handleProviderNotification({ provider, event: event as any, req });
}