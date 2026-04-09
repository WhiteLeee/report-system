"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentType } from "react";

import type { NavigationMenuItem, SessionUser } from "@/backend/auth/auth.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BarChart3, FileText, LogOut, Settings2, ShieldUser, User, Wrench } from "@/components/ui/icons";
import { TabsList, TabsTrigger, tabsTriggerVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  currentUser,
  title,
  subtitle,
  activePath = ""
}: {
  currentUser: SessionUser;
  title: string;
  subtitle: string;
  activePath?: string;
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = currentUser.roles.includes("admin");
  const canManageUsers =
    isAdmin ||
    currentUser.permissions.includes("user:read") ||
    currentUser.permissions.includes("user:write") ||
    currentUser.permissions.includes("role:read") ||
    currentUser.permissions.includes("role:write") ||
    currentUser.permissions.includes("scope:write");
  const canManageSystem = isAdmin;
  const normalizedActivePath = activePath.trim();
  const fallbackNavigationItems = [
    {
      href: "/reports",
      label: "报告列表",
      icon: "file-text",
      active: normalizedActivePath.startsWith("/reports")
    },
    {
      href: "/rectifications",
      label: "整改单",
      icon: "wrench",
      active: normalizedActivePath.startsWith("/rectifications")
    },
    {
      href: "/analytics",
      label: "数据分析",
      icon: "bar-chart-3",
      active: normalizedActivePath.startsWith("/analytics")
    },
    ...(canManageUsers
      ? [
          {
            href: "/admin/users",
            label: "用户管理",
            icon: "shield-user",
            active:
              normalizedActivePath.startsWith("/admin/users") ||
              normalizedActivePath.startsWith("/admin/roles")
          }
        ]
      : []),
    ...(canManageSystem
      ? [
          {
            href: "/master-data",
            label: "系统管理",
            icon: "settings-2",
            active:
              normalizedActivePath.startsWith("/master-data") ||
              normalizedActivePath.startsWith("/admin/settings") ||
              normalizedActivePath.startsWith("/admin/audit")
          }
        ]
      : [])
  ] as const;
  const menuIconMap: Record<string, ComponentType<{ className?: string }>> = {
    "file-text": FileText,
    wrench: Wrench,
    "bar-chart-3": BarChart3,
    "shield-user": ShieldUser,
    "settings-2": Settings2
  };
  const resolvedNavigationItems = (
    Array.isArray(currentUser.navigationMenus) && currentUser.navigationMenus.length > 0
      ? currentUser.navigationMenus.map((menu: NavigationMenuItem) => ({
          href: menu.href,
          label: menu.label,
          icon: menu.icon || "file-text",
          active: normalizedActivePath.startsWith(menu.href)
        }))
      : fallbackNavigationItems
  ).filter((item) => item.href !== "/master-data" || canManageSystem);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <header className="mb-8 flex flex-col gap-6 border-b border-zinc-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="eyebrow">Report Workspace</p>
        <h1 className="mt-0 text-4xl font-semibold tracking-tight text-zinc-950 lg:text-5xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 sm:text-base">{subtitle}</p>
      </div>
      <div className="flex flex-col items-start gap-3 lg:min-w-[420px] lg:items-end">
        <div className="flex w-full items-center justify-end gap-2">
          <TabsList className="rounded-full border border-zinc-200 bg-zinc-100/80 shadow-sm">
            {resolvedNavigationItems.map((item) => {
              const Icon = menuIconMap[item.icon] || FileText;
              return (
                <TabsTrigger asChild isActive={item.active} key={item.href}>
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </TabsTrigger>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    tabsTriggerVariants({
                      state: "inactive",
                      orientation: "horizontal"
                    }),
                    "rounded-full"
                  )}
                  type="button"
                >
                  <User className="h-4 w-4" />
                  {currentUser.username}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-zinc-950">{currentUser.username}</div>
                    <div className="text-xs text-zinc-500">当前登录账号</div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <button disabled={isLoggingOut} onClick={handleLogout} type="button">
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? "退出中..." : "退出登录"}
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>
        </div>
      </div>
    </header>
  );
}
