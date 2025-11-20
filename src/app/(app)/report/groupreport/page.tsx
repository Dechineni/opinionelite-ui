// FILE: src/app/(app)/report/groupreport/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function GroupReport() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Group Report</h1>
      {/* TODO: render your group report form here */}
      <div className="rounded-lg border bg-white p-4">UI coming soon…</div>
    </div>
  );
}