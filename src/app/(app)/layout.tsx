// FILE: src/app/(app)/layout.tsx
export const runtime = 'edge';
import "../globals.css";
import type { Metadata } from "next";
import Shell from "../shell";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Opinion Elite", description: "UI" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();               // ✅ await
  // You can guard here or let middleware handle redirects.
  // if (!session) redirect("/login");

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <Shell
          role={(session?.user.role as "admin" | "manager") ?? "manager"}
          userName={session?.user.name ?? "User"}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}