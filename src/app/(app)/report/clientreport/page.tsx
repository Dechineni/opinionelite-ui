// FILE: src/app/(app)/report/clientreport/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ClientReportForm from "./ClientReportForm";

export default async function ClientReport() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return <ClientReportForm />;
}
