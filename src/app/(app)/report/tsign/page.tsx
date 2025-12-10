// FILE: src/app/(app)/report/tsign/page.tsx

import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";
import TSignUI from "./TSignUI";

export default async function TSignReportPage() {
  const session = await getServerSession();

  if (!session) {
    return redirect("/login");
  }

  return <TSignUI session={session} />;
}
