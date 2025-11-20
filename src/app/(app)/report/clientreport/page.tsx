// FILE: src/app/(app)/report/clientreport/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function ClientReport() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Client Report</h1>
      {/* TODO: render your client report form here */}
      <div className="rounded-lg border bg-white p-4">UI coming soon…</div>
    </div>
  );
}