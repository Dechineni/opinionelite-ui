// FILE: src/app/shell.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar, { type Role } from "@/components/Sidebar";

type ShellProps = {
  children: React.ReactNode;
  role?: Role;
  userName?: string;
};

export default function Shell({
  children,
  role = "manager",
  userName = "User",
}: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Avoid sidebar on login page
  if (pathname?.startsWith("/login")) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <Topbar userName={userName} />

      <div className="flex">
        {/* FIXED WIDTH SIDEBAR */}
        <Sidebar
          role={role}
          activePath={pathname ?? "/"}
          fixedWidth={true}   // NEW OPTION
          onNavigate={(href: string) => router.push(href)}
        />

        {/* MAIN CONTENT - NO EXTRA PADDING LEFT */}
        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
