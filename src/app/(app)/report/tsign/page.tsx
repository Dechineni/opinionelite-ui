// FILE: src/app/(app)/report/tsign/page.tsx
export const runtime = 'edge';

import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import TSignForm from "./TSignForm";

export default async function Tsign() {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/dashboard");

  return <TSignForm />;
}


