// FILE: src/app/(app)/users/userlist/page.tsx  (User List)
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function UserListPage() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">User List</h1>
      {/* TODO: render your actual table here */}
      <div className="rounded-lg border bg-white p-4">Coming soon…</div>
    </div>
  );
}