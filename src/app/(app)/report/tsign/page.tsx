// FILE: src/app/(app)/report/tsign/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Tsign() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Tsign</h1>
      {/* TODO: render your tsign form here */}
      <div className="rounded-lg border bg-white p-4">UI coming soon…</div>
    </div>
  );
}