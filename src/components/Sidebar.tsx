// FILE: src/components/Sidebar.tsx
"use client";

import React, { useMemo, useState } from "react";
import {
  LayoutGrid,
  FileText,
  Users,
  Building2,
  FileBarChart2,
  ChevronDown,
  UserCog,
} from "lucide-react";

export type Role = "admin" | "manager";

export type LeafItem = {
  key: string;
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number }>;
};
export type GroupItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children: Array<LeafItem | GroupItem>;
};
export type RootItem = LeafItem | GroupItem;

const isGroup = (x: RootItem): x is GroupItem => "children" in x;

function buildMenu(role: Role): RootItem[] {
  const base: RootItem[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    {
      key: "project",
      label: "Project",
      icon: FileText,
      children: [
        { key: "project-list", label: "Project List", href: "/projects/new/projectlist" },
        {
          key: "project-create",
          label: "Create Project",
          icon: FileText,
          children: [
            { key: "single", label: "Single", href: "/projects/new/single" },
            { key: "group", label: "Group", href: "/projects/new/group" },
            { key: "recontact", label: "ReContact", href: "/projects/new/recontact" },
            { key: "api", label: "API Survey", href: "/projects/new/api" },
          ],
        },
      ],
    },
    {
      key: "client",
      label: "Client",
      icon: Users,
      children: [
        { key: "client-list", label: "Client List", href: "/client/new/clientlist" },
        { key: "client-add", label: "Add Client", href: "/client/new/addclient" },
      ],
    },
    {
      key: "supplier",
      label: "Supplier",
      icon: Building2,
      children: [
        { key: "sup-list", label: "Supplier List", href: "/supplier/new/supplierlist" },
        { key: "sup-add", label: "Add Supplier", href: "/supplier/new/addsupplier" },
      ],
    },
    {
      key: "report",
      label: "Report",
      icon: FileBarChart2,
      children: [
        { key: "rep-client", label: "Client Report", href: "/report/clientreport" },
        { key: "rep-supplier", label: "Supplier Report", href: "/report/supplierreport" },
        { key: "rep-group", label: "Group Report", href: "/report/groupreport" },
        { key: "rep-tsign", label: "TSign", href: "/report/tsign" },
      ],
    },
  ];

  if (role === "admin") {
    base.push({
      key: "user",
      label: "User",
      icon: UserCog,
      children: [
        { key: "user-list", label: "User List", href: "/users/userlist" },
        { key: "user-add", label: "Add User", href: "/users/adduser" },
      ],
    });
  }

  return base;
}

export default function Sidebar({
  role = "manager",
  activePath = "/",
  fixedWidth = true,
  onNavigate,
}: any) {
  const MENU = useMemo(() => buildMenu(role), [role]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) =>
    setOpenGroups((o) => ({ ...o, [key]: !o[key] }));

  const handleNav = (href: string) => (e: any) => {
    e.preventDefault();
    onNavigate?.(href);
  };

  return (
    <aside className="h-[calc(100vh-64px)] w-64 border-r bg-white">
      <nav className="overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {MENU.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              activePath={activePath}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              handleNav={handleNav}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function NavItem({ item, activePath, openGroups, toggleGroup, handleNav }: any) {
  if (isGroup(item)) {
    const open = openGroups[item.key];

    return (
      <li>
        <button
          onClick={() => toggleGroup(item.key)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-100"
        >
          <item.icon size={18} />
          <span>{item.label}</span>
          <ChevronDown
            size={16}
            className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <ul className="ml-6 mt-1 space-y-1">
            {item.children.map((c: any) => (
              <NavItem
                key={c.key}
                item={c}
                activePath={activePath}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                handleNav={handleNav}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = activePath.startsWith(item.href);

  return (
    <li>
      <a
        href={item.href}
        onClick={handleNav(item.href)}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-100 ${
          active ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"
        }`}
      >
        {item.icon && <item.icon size={18} />}
        <span>{item.label}</span>
      </a>
    </li>
  );
}
