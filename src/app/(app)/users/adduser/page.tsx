// FILE: src/app/(app)/users/adduser/page.tsx  (Add User)
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AddUserPage() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Add User</h1>
      {/* TODO: render your Add User form here */}
      <div className="rounded-lg border bg-white p-4">Form coming soon…</div>
    </div>
  );
}