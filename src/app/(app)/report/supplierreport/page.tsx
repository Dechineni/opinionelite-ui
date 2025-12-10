// FILE: src/app/(app)/report/supplierreport/page.tsx
 
import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import SupplierReportUI from "./SupplierReportUI";

export default async function SupplierReportPage() {
  const session = await getServerSession();

  if (!session) {
    return redirect("/login");
  }

  return <SupplierReportUI session={session} />;
}