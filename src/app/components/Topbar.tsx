"use client";
export const runtime = 'edge';

import Image from "next/image";
import Link from "next/link";
import { Maximize2, Minimize2, UserRound, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title?: string;
  userName?: string;
};

export default function Topbar({
  title = "Opinion Elite",
  userName = "User",
}: Props) {
  const router = useRouter();
  const [isFull, setIsFull] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  const onLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      setMenuOpen(false);
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 items-center gap-3 px-4">
        {/* Brand: logo + title */}
        <Link href="/dashboard" className="flex items-center gap-3 select-none" aria-label="Go to dashboard">
          <Image
            src="/logo.svg"
            alt="Opinion Elite"
            width={36}
            height={36}
            priority
            className="h-9 w-9"
          />
          <div className="text-sm font-semibold leading-tight">{title}</div>
        </Link>

        {/* Right: fullscreen & user menu */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="rounded-lg p-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
          >
            {isFull ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* User dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full px-1.5 py-1 hover:bg-slate-100 focus:outline-none"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="topbar-user-menu"
            >
              <span className="text-sm font-medium">{userName}</span>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-white">
                <UserRound size={18} />
              </div>
            </button>

            {menuOpen && (
              <div
                id="topbar-user-menu"
                role="menu"
                className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border bg-white shadow-lg z-50"
              >
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-500">Signed in as</p>
                  <p className="truncate text-sm font-medium">{userName}</p>
                </div>
                <div className="h-px bg-slate-100" />
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  role="menuitem"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}