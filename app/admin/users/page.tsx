import Link from "next/link";

import styles from "./admin-users-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createAuthService } from "@/backend/auth/auth.module";
import { roleCodes } from "@/backend/auth/auth.types";
import { createMasterDataService } from "@/backend/master-data/master-data.module";
import type { MasterDataEnterpriseSummary } from "@/backend/master-data/master-data.types";
import type { MasterDataOrganization } from "@/backend/master-data/master-data.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/ui/dashboard-header";

export const dynamic = "force-dynamic";

const authService = createAuthService();
const masterDataService = createMasterDataService();

interface ScopeOption {
  value: string;
  label: string;
  meta?: string;
}

function statusBadgeClass(status: string): string {
  return status === "active" ? styles.activeBadge : styles.disabledBadge;
}

function flattenOrganizations(rows: MasterDataOrganization[], depth = 0): Array<MasterDataOrganization & { depth: number }> {
  return rows.flatMap((row) => [
    { ...row, depth },
    ...flattenOrganizations(row.child || [], depth + 1)
  ]);
}

function sortOrganizationTree(nodes: MasterDataOrganization[]): MasterDataOrganization[] {
  return [...nodes]
    .sort((left, right) => {
      const countDiff = right.current_store_count - left.current_store_count;
      if (countDiff !== 0) {
        return countDiff;
      }
      return left.organize_name.localeCompare(right.organize_name, "zh-CN");
    })
    .map((node) => ({
      ...node,
      child: sortOrganizationTree(node.child)
    }));
}

function enterpriseOptionsFromContext(
  currentUser: Awaited<ReturnType<typeof requirePermission>>,
  enterprises: MasterDataEnterpriseSummary[]
): ScopeOption[] {
  if (enterprises.length > 0) {
    return enterprises.map((enterprise) => ({
      value: enterprise.enterprise_id,
      label: enterprise.enterprise_name || enterprise.enterprise_id,
      meta: `${enterprise.organize_count} 个组织 · ${enterprise.store_count} 家门店`
    }));
  }

  return currentUser.enterpriseScopeIds.map((enterpriseId) => ({
    value: enterpriseId,
    label: enterpriseId
  }));
}

function renderScopePicker(
  title: string,
  fieldName: string,
  options: ScopeOption[],
  selectedValues: string[],
  emptyCopy: string
) {
  return (
    <section className={styles.scopeField}>
      <div className={styles.scopeFieldHeader}>
        <h4 className={styles.scopeFieldTitle}>{title}</h4>
        <p className={styles.scopeFieldCopy}>勾选授权范围；不勾选表示全部可见。</p>
      </div>
      {options.length > 0 ? (
        <div className={styles.scopePicker}>
          {options.map((option) => (
            <label className={styles.scopeOption} key={`${fieldName}-${option.value}`}>
              <input
                className={styles.scopeCheckbox}
                defaultChecked={selectedValues.includes(option.value)}
                name={fieldName}
                type="checkbox"
                value={option.value}
              />
              <span className={styles.scopeOptionBody}>
                <span className={styles.scopeOptionLabel}>{option.label}</span>
                {option.meta ? <span className={styles.scopeOptionMeta}>{option.meta}</span> : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className={styles.scopeEmpty}>{emptyCopy}</div>
      )}
    </section>
  );
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("user:manage", "/admin/users");
  const users = authService.listUsers();
  const resolvedSearchParams = await searchParams;
  const dialog = typeof resolvedSearchParams.dialog === "string" ? resolvedSearchParams.dialog : "";
  const editingUserId = typeof resolvedSearchParams.userId === "string" ? Number(resolvedSearchParams.userId) : NaN;
  const editingUser = Number.isInteger(editingUserId) ? users.find((user) => user.id === editingUserId) ?? null : null;
  const isCreateDialogOpen = dialog === "create";
  const isEditDialogOpen = dialog === "edit" && !!editingUser;
  const enterprises = masterDataService.listEnterprises(currentUser);
  const enterpriseOptions = enterpriseOptionsFromContext(currentUser, enterprises);
  const organizationOptions = enterpriseOptions.flatMap((enterprise) =>
    flattenOrganizations(masterDataService.listOrganizations(enterprise.value, currentUser)).map((organization) => ({
      value: organization.organize_code,
      label: `${"  ".repeat(organization.depth)}${organization.organize_name}`,
      meta: `${enterprise.label} · ${organization.current_store_count} 家门店`
    }))
  );

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="集中管理本地用户、角色、状态和范围授权。"
        title="用户管理"
      />

      <section className="section">
        <Card className={styles.workspaceCard}>
          <CardHeader className={styles.workspaceHeader}>
            <div>
              <CardTitle className={styles.workspaceTitle}>用户列表</CardTitle>
              <CardDescription className={styles.workspaceCopy}>
                先查看当前用户清单，再通过弹窗完成新增和修改，不再把所有操作揉在主页面里。
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/admin/users?dialog=create">新增用户</Link>
            </Button>
          </CardHeader>
          <CardContent className={styles.workspaceBody}>
            <div className={styles.tableShell}>
              <div className={styles.tableWrap}>
                <table className={styles.userTable}>
                  <thead>
                    <tr>
                      <th>账号</th>
                      <th>显示名</th>
                      <th>角色</th>
                      <th>权限</th>
                      <th>企业范围</th>
                      <th>组织范围</th>
                      <th>状态</th>
                      <th>更新时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr className={styles.userRow} key={user.id}>
                        <td>
                          <span className={styles.cellValue}>{user.username}</span>
                        </td>
                        <td>
                          <span className={styles.cellValue}>{user.displayName}</span>
                        </td>
                        <td>
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge className={styles.roleBadge} key={role} variant="outline">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className={styles.cellMeta}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={styles.permissionText} title={user.permissions.join(", ") || "-"}>
                            {user.permissions.join(", ") || "-"}
                          </span>
                        </td>
                        <td>
                          <span className={styles.scopeText} title={user.enterpriseScopeIds.join(", ") || "全部企业"}>
                            {user.enterpriseScopeIds.join(", ") || "全部企业"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles.scopeText}
                            title={user.organizationScopeIds.join(", ") || "全部组织"}
                          >
                            {user.organizationScopeIds.join(", ") || "全部组织"}
                          </span>
                        </td>
                        <td>
                          <Badge className={cn(styles.statusBadge, statusBadgeClass(user.status))} variant="secondary">
                            {user.status}
                          </Badge>
                        </td>
                        <td>
                          <span className={styles.cellMeta}>{user.updatedAt || "-"}</span>
                        </td>
                        <td className={styles.actionCell}>
                          <Button asChild className={styles.inlineActionButton} size="sm" variant="secondary">
                            <Link href={`/admin/users?dialog=edit&userId=${user.id}`}>编辑</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {isCreateDialogOpen ? (
        <div className={styles.modalOverlay}>
          <Link aria-label="关闭新增用户弹窗" className={styles.modalBackdrop} href="/admin/users" />
          <Link aria-label="关闭新增用户弹窗" className={styles.modalCloseArea} href="/admin/users" />
          <Card className={styles.modalCard}>
            <CardHeader className={styles.modalHeader}>
              <div>
                <CardTitle className={styles.modalTitle}>新增用户</CardTitle>
                <CardDescription className={styles.modalCopy}>创建账号、分配角色并补充范围授权。</CardDescription>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/users">关闭</Link>
              </Button>
            </CardHeader>
            <CardContent className={styles.modalBody}>
              <form action="/admin/users/create" className={styles.userForm} method="post">
                <div className={styles.formGrid}>
                  <div className="field">
                    <label htmlFor="username">账号</label>
                    <Input id="username" name="username" required />
                  </div>
                  <div className="field">
                    <label htmlFor="displayName">显示名</label>
                    <Input id="displayName" name="displayName" required />
                  </div>
                  <div className="field">
                    <label htmlFor="password">初始密码</label>
                    <Input id="password" minLength={8} name="password" required type="password" />
                  </div>
                  <div className="field">
                    <label htmlFor="roleCode">角色</label>
                    <NativeSelect defaultValue="viewer" id="roleCode" name="roleCode">
                      {roleCodes.map((roleCode) => (
                        <option key={roleCode} value={roleCode}>
                          {roleCode}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className={styles.scopeGrid}>
                  {renderScopePicker("企业范围", "enterpriseScopeIds", enterpriseOptions, [], "当前没有可选择的企业范围。")}
                  {renderScopePicker("组织范围", "organizationScopeIds", organizationOptions, [], "当前没有可选择的组织范围。")}
                </div>
                <div className={styles.formActions}>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/admin/users">取消</Link>
                  </Button>
                  <Button size="sm" type="submit">
                    创建用户
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isEditDialogOpen && editingUser ? (
        <div className={styles.modalOverlay}>
          <Link aria-label="关闭编辑用户弹窗" className={styles.modalBackdrop} href="/admin/users" />
          <Link aria-label="关闭编辑用户弹窗" className={styles.modalCloseArea} href="/admin/users" />
          <Card className={styles.modalCard}>
            <CardHeader className={styles.modalHeader}>
              <div className={styles.userHeaderBlock}>
                <div>
                  <CardTitle className={styles.modalTitle}>编辑用户</CardTitle>
                  <CardDescription className={styles.modalCopy}>
                    统一维护角色、组织授权和账号状态。
                  </CardDescription>
                </div>
                <div className={styles.userIdentityCard}>
                  <div>
                    <div className={styles.userIdentityTitle}>{editingUser.displayName}</div>
                    <div className={styles.userIdentityMeta}>账号：{editingUser.username}</div>
                  </div>
                  <Badge className={cn(styles.statusBadge, statusBadgeClass(editingUser.status))} variant="secondary">
                    {editingUser.status}
                  </Badge>
                </div>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/users">关闭</Link>
              </Button>
            </CardHeader>
            <CardContent className={styles.modalBody}>
              <div className={styles.editLayout}>
                <div className={styles.sideRail}>
                  <section className={styles.editCard}>
                    <div className={styles.editCardHeader}>
                      <h3 className={styles.editSectionTitle}>角色</h3>
                      <p className={styles.editSectionCopy}>一个用户当前只保留一个主角色。</p>
                    </div>
                    <form action={`/admin/users/${editingUser.id}/role`} className={styles.cardForm} method="post">
                      <div className="field">
                        <label htmlFor={`roleCode-${editingUser.id}`}>角色类型</label>
                        <NativeSelect defaultValue={editingUser.roles[0] || "viewer"} id={`roleCode-${editingUser.id}`} name="roleCode">
                          {roleCodes.map((roleCode) => (
                            <option key={roleCode} value={roleCode}>
                              {roleCode}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className={styles.cardActions}>
                        <Button size="sm" type="submit">更新角色</Button>
                      </div>
                    </form>
                  </section>

                  <section className={styles.editCard}>
                    <div className={styles.editCardHeader}>
                      <h3 className={styles.editSectionTitle}>账号操作</h3>
                      <p className={styles.editSectionCopy}>重置密码和启停账号放在同一个控制区。</p>
                    </div>
                    <form action={`/admin/users/${editingUser.id}/password`} className={styles.cardForm} method="post">
                      <div className="field">
                        <label htmlFor={`password-${editingUser.id}`}>新密码</label>
                        <Input
                          id={`password-${editingUser.id}`}
                          minLength={8}
                          name="password"
                          placeholder="新密码，至少 8 位"
                          required
                          type="password"
                        />
                      </div>
                      <div className={styles.cardActions}>
                        <Button size="sm" type="submit" variant="secondary">
                          重置密码
                        </Button>
                      </div>
                    </form>

                    <form action={`/admin/users/${editingUser.id}/status`} className={styles.statusPanel} method="post">
                      <input name="status" type="hidden" value={editingUser.status === "active" ? "disabled" : "active"} />
                      <div className={styles.statusMeta}>
                        <span className={styles.statusLabel}>当前状态</span>
                        <Badge className={cn(styles.statusBadge, statusBadgeClass(editingUser.status))} variant="secondary">
                          {editingUser.status}
                        </Badge>
                      </div>
                      <Button size="sm" type="submit" variant="secondary">
                        {editingUser.status === "active" ? "禁用账号" : "启用账号"}
                      </Button>
                    </form>
                  </section>
                </div>

                <section className={`${styles.editCard} ${styles.scopeCard}`}>
                  <div className={styles.editCardHeader}>
                    <h3 className={styles.editSectionTitle}>范围授权</h3>
                    <p className={styles.editSectionCopy}>只配置企业和组织范围。组织授权会自动展开到该组织下的门店。</p>
                  </div>
                  <form action={`/admin/users/${editingUser.id}/scopes`} className={styles.cardForm} method="post">
                    <div className={styles.scopeGrid}>
                      {renderScopePicker(
                        "企业范围",
                        "enterpriseScopeIds",
                        enterpriseOptions,
                        editingUser.enterpriseScopeIds,
                        "当前没有可选择的企业范围。"
                      )}
                      {renderScopePicker(
                        "组织范围",
                        "organizationScopeIds",
                        organizationOptions,
                        editingUser.organizationScopeIds,
                        "当前没有可选择的组织范围。"
                      )}
                    </div>
                    <div className={styles.cardActions}>
                      <Button size="sm" type="submit">更新范围</Button>
                    </div>
                  </form>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
