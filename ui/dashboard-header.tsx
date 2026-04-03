"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, LogOut, Settings2, User, Wrench } from "lucide-react";

import type { SessionUser } from "@/backend/auth/auth.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { TabsList, TabsTrigger, tabsTriggerVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  currentUser,
  title,
  subtitle
}: {
  currentUser: SessionUser;
  title: string;
  subtitle: string;
}) {
  const pathname = usePathname();
  const isAdmin = currentUser.roles.includes("admin");
  const navigationItems = [
    { href: "/reports", label: "报告列表", icon: FileText, active: pathname.startsWith("/reports") },
    { href: "/rectifications", label: "整改单", icon: Wrench, active: pathname.startsWith("/rectifications") },
    { href: "/analytics", label: "数据分析", icon: BarChart3, active: pathname.startsWith("/analytics") },
    ...(isAdmin
      ? [
          {
            href: "/master-data",
            label: "系统管理",
            icon: Settings2,
            active:
              pathname.startsWith("/master-data") ||
              pathname.startsWith("/admin/users") ||
              pathname.startsWith("/admin/settings")
          }
        ]
      : [])
  ] as const;

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
            {navigationItems.map((item) => {
              const Icon = item.icon;
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
              <form action="/api/auth/logout" method="post">
                <DropdownMenuItem asChild>
                  <button type="submit">
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
          </TabsList>
        </div>
      </div>
    </header>
  );
}
