import Link from "next/link";

import styles from "./roles-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createAuthService } from "@/backend/auth/auth.module";
import { permissionCodes } from "@/backend/auth/auth.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { AccessManagementTabs } from "@/ui/shared/access-management-tabs";

export const dynamic = "force-dynamic";

const authService = createAuthService();

const permissionMeta: Record<(typeof permissionCodes)[number], { label: string; description: string }> = {
  "report:read": { label: "报告查看", description: "可访问报告列表、批次详情和结果详情。" },
  "review:write": { label: "复核操作", description: "可执行复核、更新状态并提交复核备注。" },
  "rectification:read": { label: "整改单查看", description: "可访问整改单列表与整改状态。" },
  "analytics:read": { label: "分析查看", description: "可访问数据分析页面和图表。" },
  "analytics:job:manage": { label: "分析任务管理", description: "可手动触发分析任务重建。" },
  "master-data:read": { label: "主数据查看", description: "可访问门店主数据组织树和门店列表。" },
  "user:read": { label: "用户查看", description: "可查看用户列表和账号信息。" },
  "user:write": { label: "用户管理", description: "可新增用户、重置密码、启停账号。" },
  "role:read": { label: "角色查看", description: "可查看角色与权限矩阵。" },
  "role:write": { label: "角色管理", description: "可修改用户角色与权限矩阵。" },
  "scope:write": { label: "范围授权", description: "可修改企业、组织与门店授权范围。" },
  "system:settings:read": { label: "设置查看", description: "可访问系统设置页面。" },
  "system:settings:write": { label: "设置管理", description: "可修改系统设置。" }
};

function normalizeQueryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminRolesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("role:read", "/admin/roles");
  const isAdmin = currentUser.roles.includes("admin");
  const canWriteRoles = currentUser.permissions.includes("role:write");
  const matrix = authService.listRolePermissionMatrix().filter((roleItem) => (isAdmin ? true : roleItem.roleCode !== "admin"));
  const resolvedSearchParams = await searchParams;
  const saved = normalizeQueryValue(resolvedSearchParams.saved) === "1";

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/admin/roles"
        currentUser={currentUser}
        subtitle="集中管理角色权限矩阵，避免把权限治理混在系统设置中。"
        title="角色权限"
      />

      <section className="section">
        <AccessManagementTabs activeTab="roles" />
      </section>

      <section className="section">
        <Card className={styles.workspaceCard}>
          <CardHeader className={styles.workspaceHeader}>
            <div>
              <CardTitle className={styles.workspaceTitle}>权限矩阵</CardTitle>
              <CardDescription className={styles.workspaceCopy}>
                管理角色可访问的功能权限，系统治理权限默认仅开放给管理员。
              </CardDescription>
            </div>
            {canWriteRoles ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="#save-role-permission">保存变更</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className={styles.workspaceBody}>
            {saved ? <div className={styles.saveNotice}>角色权限已保存。</div> : null}
            <form action="/admin/roles/save" method="post">
              <div className={styles.permissionGrid}>
                {matrix.map((roleItem) => {
                  const isAdminRole = roleItem.roleCode === "admin";
                  return (
                    <article className={styles.permissionCard} key={roleItem.roleCode}>
                      <div className={styles.permissionRoleHead}>
                        <div>
                          <h4 className={styles.workspaceTitle}>
                            {roleItem.roleName}（{roleItem.roleCode}）
                          </h4>
                          <p className={styles.settingSectionCopy}>{roleItem.roleDescription || "暂无角色说明。"}</p>
                        </div>
                        <Badge variant={isAdminRole ? "secondary" : "outline"}>
                          {isAdminRole ? "固定" : "可配置"}
                        </Badge>
                      </div>

                      <div className={styles.permissionChecklist}>
                        {permissionCodes.map((permissionCode) => {
                          const checked = roleItem.permissionCodes.includes(permissionCode);
                          const adminOnly =
                            permissionCode === "master-data:read" ||
                            permissionCode === "system:settings:read" ||
                            permissionCode === "system:settings:write";
                          const disabled = !canWriteRoles || isAdminRole || adminOnly;
                          return (
                            <label className={styles.permissionOption} key={`${roleItem.roleCode}-${permissionCode}`}>
                              <input
                                defaultChecked={checked}
                                disabled={disabled}
                                name={`permissions_${roleItem.roleCode}`}
                                type="checkbox"
                                value={permissionCode}
                              />
                              <span className={styles.permissionOptionBody}>
                                <strong>{permissionMeta[permissionCode].label}</strong>
                                <span>{permissionMeta[permissionCode].description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className={styles.settingSectionCopy}>
                        {isAdminRole
                          ? "管理员权限固定为全量，确保系统管理能力始终可用。"
                          : "普通角色仅开放业务读取与复核相关权限，系统与账号治理权限仅保留给管理员。"}
                      </p>
                    </article>
                  );
                })}
              </div>

              {canWriteRoles ? (
                <div className={styles.formActions} id="save-role-permission">
                  <Button size="sm" type="submit">
                    保存权限矩阵
                  </Button>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
