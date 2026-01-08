// FILE: src/app/(app)/report/groupreport/page.tsx

import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import GroupReportUI from "./GroupReportUI";

export default async function GroupReportPage() {
  const session = await getServerSession();
  
  if (!session) {
    return redirect("/login");
  }

  return <GroupReportUI session={session} />;
}
