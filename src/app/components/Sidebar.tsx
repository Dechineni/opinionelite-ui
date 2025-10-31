// FILE: src/app/components/Sidebar.tsx
"use client";
export const runtime = 'edge';

import React, { useMemo, useState } from "react";
import {
  LayoutGrid,
  FileText,
  Users,
  Building2,
  FileBarChart2,
  ChevronDown,
  Menu,
  UserCog,
} from "lucide-react";

export type Role = "admin" | "manager";

/* --------------------------- Menu item definitions -------------------------- */
export type LeafItem = {
  key: string;
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};
export type GroupItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: Array<LeafItem | GroupItem>;
};
export type RootItem = LeafItem | GroupItem;

const isGroup = (i: RootItem): i is GroupItem =>
  (i as GroupItem).children !== undefined;

/* ------------------------------- Build menu -------------------------------- */
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
            { key: "project-single", label: "Single", href: "/projects/new/single" },
            { key: "project-group", label: "Group", href: "/projects/new/group" },
            { key: "project-recontact", label: "ReContact", href: "/projects/new/recontact" },
            { key: "project-api", label: "API Survey", href: "/projects/new/api" },
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
        { key: "supplier-list", label: "Supplier List", href: "/supplier/new/supplierlist" },
        { key: "supplier-add", label: "Add Supplier", href: "/supplier/new/addsupplier" },
      ],
    },
    {
      key: "report",
      label: "Report",
      icon: FileBarChart2,
      children: [
        { key: "report-client", label: "Client Report", href: "/reports/client" },
        { key: "report-supplier", label: "Supplier Report", href: "/reports/supplier" },
        { key: "report-group", label: "Group Report", href: "/reports/group" },
        { key: "report-tsign", label: "TSign", href: "/reports/tsign" },
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

/* --------------------------------- Styles ---------------------------------- */
const cls = {
  aside: (collapsed: boolean) =>
    `relative h-[calc(100vh-4rem)] border-r bg-white shadow-sm transition-[width] duration-200 ${
      collapsed ? "w-[72px]" : "w-64"
    }`,
  header: "flex h-14 items-center gap-3 px-3",
  hamburger: "ml-auto rounded-lg p-2 hover:bg-slate-100",
  nav: "h-[calc(100%-3.5rem)] overflow-y-auto px-2 pb-6",
  itemBase:
    "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
  itemIcon: "shrink-0",
  itemLabel: "truncate",
  itemActive:
    "bg-slate-100 font-semibold text-slate-900 border-l-4 border-emerald-500 -ml-3 pl-2.5",
  chevron: (open: boolean) =>
    `ml-auto transition-transform ${open ? "rotate-180" : "rotate-0"}`,
};

/* --------------------------- Helpers: open groups --------------------------- */
function groupsContainingPath(
  items: RootItem[],
  path: string,
  acc: Set<string> = new Set()
): Set<string> {
  for (const item of items) {
    if (isGroup(item)) {
      const before = acc.size;
      groupsContainingPath(item.children, path, acc);
      const matched =
        acc.size !== before ||
        item.children.some((c) => !isGroup(c) && path.startsWith(c.href));
      if (matched) acc.add(item.key);
    }
  }
  return acc;
}

/* ------------------------------- Component --------------------------------- */
export interface SidebarProps {
  role?: Role;
  activePath?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  showHeaderToggle?: boolean;
  showHeaderBrand?: boolean;
  initialCollapsed?: boolean;
  onNavigate?: (href: string) => void;
}

export default function Sidebar({
  role = "manager",
  activePath = "/",
  collapsed,
  onCollapsedChange,
  showHeaderToggle = true,
  showHeaderBrand = false,
  initialCollapsed = false,
  onNavigate,
}: SidebarProps) {
  const MENU = useMemo(() => buildMenu(role), [role]);

  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);
  const isControlled = typeof collapsed === "boolean";
  const c = isControlled ? (collapsed as boolean) : internalCollapsed;
  const setC = (val: boolean) => {
    onCollapsedChange?.(val);
    if (!isControlled) setInternalCollapsed(val);
  };

  const initialOpen = useMemo(
    () => Array.from(groupsContainingPath(MENU, activePath)),
    [MENU, activePath]
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () =>
      initialOpen.reduce(
        (o, k) => ({ ...o, [k]: true }),
        {} as Record<string, boolean>
      )
  );

  const toggleGroup = (key: string) =>
    setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
  const handleNav = (href: string) => (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  return (
    <aside className={cls.aside(c)}>
      {/* header */}
      <div className={cls.header}>
        {showHeaderBrand && !c ? (
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
              <span className="text-sm font-black leading-none">OE</span>
            </div>
            <div className="select-none">
              <div className="text-sm font-semibold leading-tight">
                Opinion Elite
              </div>
              <div className="text-[10px] text-slate-500">
                {role === "admin" ? "Admin" : "Manager"}
              </div>
            </div>
          </div>
        ) : (
          <div />
        )}
        {showHeaderToggle && (
          <button
            type="button"
            aria-label="Toggle sidebar"
            className={cls.hamburger}
            onClick={() => setC(!c)}
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      {/* nav */}
      <nav className={cls.nav} aria-label="Sidebar">
        <ul className="space-y-1">
          {MENU.map((item) => (
            <NavItem
              key={(item as any).key}
              item={item}
              depth={0}
              collapsed={c}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              activePath={activePath}
              handleNav={handleNav}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/* ------------------------------ NavItem row -------------------------------- */
function NavItem({
  item,
  depth,
  collapsed,
  openGroups,
  toggleGroup,
  activePath,
  handleNav,
}: {
  item: RootItem;
  depth: number;
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (key: string) => void;
  activePath: string;
  handleNav: (href: string) => (e: React.MouseEvent) => void;
}) {
  if (isGroup(item)) {
    const active =
      item.children.some((c) => (isGroup(c) ? false : activePath.startsWith(c.href))) ||
      openGroups[item.key];

    return (
      <li>
        <button
          type="button"
          className={[cls.itemBase, active ? cls.itemActive : ""].join(" ")}
          onClick={() => toggleGroup(item.key)}
          aria-expanded={openGroups[item.key] || false}
          title={item.label}
        >
          <item.icon className={cls.itemIcon} size={18} />
          {!collapsed && <span className={cls.itemLabel}>{item.label}</span>}
          {!collapsed && (
            <ChevronDown className={cls.chevron(!!openGroups[item.key])} size={16} />
          )}
        </button>

        {openGroups[item.key] && !collapsed && (
          <ul
            className="mt-1 flex flex-col"
            style={{ marginLeft: `${Math.min(10, depth + 1) * 16}px` }}
          >
            {item.children.map((child) => (
              <NavItem
                key={(child as any).key}
                item={child}
                depth={depth + 1}
                collapsed={collapsed}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                activePath={activePath}
                handleNav={handleNav}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // ----- Leaf item -----
  const active = activePath.startsWith(item.href);
  const showIcon = !!item.icon && depth === 0;
  // Narrow the optional icon for TS-safe JSX usage
  const Icon = (item.icon ?? null) as
    | React.ComponentType<{ size?: number; className?: string }>
    | null;

  return (
    <li>
      <a
        href={item.href}
        className={[
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100",
          active
            ? "font-semibold text-emerald-700 bg-emerald-50 border-l-4 border-emerald-500 -ml-3 pl-[0.625rem]"
            : "text-slate-600",
        ].join(" ")}
        onClick={handleNav(item.href)}
        title={item.label}
      >
        {showIcon && Icon ? (
          <Icon className={cls.itemIcon} size={18} />
        ) : depth > 0 ? (
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-500" : "bg-slate-300",
            ].join(" ")}
          />
        ) : null}
        <span className="truncate">{item.label}</span>
      </a>
    </li>
  );
}