import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { key: "users", label: "用户列表", href: "/admin/users" },
  { key: "roles", label: "角色权限", href: "/admin/roles" }
] as const;

export function AccessManagementTabs({
  activeTab
}: {
  activeTab: "users" | "roles";
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
