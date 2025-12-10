// FILE: src/app/(app)/report/clientreport/page.tsx

import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import ClientReportUI from "./ClientReportUI";

export default async function ClientReportPage() {
  const session = await getServerSession();
 
  if (!session) {
    return redirect("/login");
  }

  return <ClientReportUI session={session} />;
}

// FILE: src/app/(app)/report/clientreport/ClientReportUI.tsx