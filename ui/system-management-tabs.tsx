import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { key: "master-data", label: "门店主数据", href: "/master-data" },
  { key: "users", label: "用户管理", href: "/admin/users" },
  { key: "settings", label: "系统设置", href: "/admin/settings" }
] as const;

export function SystemManagementTabs({
  activeTab
}: {
  activeTab: "master-data" | "users" | "settings";
}) {
  return (
    <Tabs>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger asChild isActive={tab.key === activeTab} key={tab.key}>
            <Link aria-current={tab.key === activeTab ? "page" : undefined} href={tab.href}>
              {tab.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
