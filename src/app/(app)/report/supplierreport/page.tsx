// FILE: src/app/(app)/report/supplierreport/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SupplierReportForm from "./SupplierReportForm";

export default async function SupplierReport() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return <SupplierReportForm />;
}
