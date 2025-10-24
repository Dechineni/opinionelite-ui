// FILE: src/app/shell.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import Topbar from "@/app/components/Topbar";
import Sidebar, { type Role } from "@/app/components/Sidebar";

type ShellProps = {
  children: React.ReactNode;

  /** Role controls whether the "User" menu shows up (admin only). */
  role?: Role; // "admin" | "manager"
  /** Shown at the right side of the top bar */
  userName?: string;
};

export default function Shell({
  children,
  role = "manager",
  userName = "User",
}: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  // If the shell ever wraps /login by mistake, render only the page (no chrome).
  if (pathname?.startsWith("/login")) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      /* ignore */
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen w-full">
      <Topbar userName={userName} onLogout={handleLogout} />
      <div className="flex">
        <Sidebar
          role={role}
          activePath={pathname ?? "/"}
          showHeaderBrand={false}   // keep brand only in Topbar
          showHeaderToggle={true}   // hamburger inside sidebar
          onNavigate={(href) => router.push(href)}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}