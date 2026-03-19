export const runtime = "edge";
export const preferredRegion = "auto";

import { handleProviderNotification } from "@/app/api/notify/_core";

export async function POST(req: Request) {
  return handleProviderNotification({ provider: "toluna", event: "terminate", req });
}
export async function GET(req: Request) {
  return handleProviderNotification({ provider: "toluna", event: "terminate", req });
}