import Link from "next/link";

import styles from "./admin-users-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createAuthService } from "@/backend/auth/auth.module";
import { roleCodes } from "@/backend/auth/auth.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/ui/dashboard-header";

export const dynamic = "force-dynamic";

const authService = createAuthService();

function statusBadgeClass(status: string): string {
  return status === "active" ? styles.activeBadge : styles.disabledBadge;
}

function parseCommaValues(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
                      <th>门店范围</th>
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
                          <span className={styles.scopeText} title={user.storeScopeIds.join(", ") || "全部门店"}>
                            {user.storeScopeIds.join(", ") || "全部门店"}
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
                  <div className="field">
                    <label htmlFor="enterpriseScopeIds">企业范围</label>
                    <Input id="enterpriseScopeIds" name="enterpriseScopeIds" placeholder="多个 enterprise_id 用英文逗号分隔" />
                  </div>
                  <div className="field">
                    <label htmlFor="organizationScopeIds">组织范围</label>
                    <Input id="organizationScopeIds" name="organizationScopeIds" placeholder="多个 organize_code 用英文逗号分隔" />
                  </div>
                  <div className="field">
                    <label htmlFor="storeScopeIds">门店范围</label>
                    <Input id="storeScopeIds" name="storeScopeIds" placeholder="多个 store_id 用英文逗号分隔" />
                  </div>
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
              <div>
                <CardTitle className={styles.modalTitle}>编辑用户</CardTitle>
                <CardDescription className={styles.modalCopy}>
                  {editingUser.username} / {editingUser.displayName}
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/users">关闭</Link>
              </Button>
            </CardHeader>
            <CardContent className={styles.modalBody}>
              <div className={styles.editSections}>
                <section className={styles.editSection}>
                  <h3 className={styles.editSectionTitle}>角色与范围</h3>
                  <form action={`/admin/users/${editingUser.id}/role`} className={styles.singleActionForm} method="post">
                    <div className="field">
                      <label htmlFor={`roleCode-${editingUser.id}`}>角色</label>
                      <NativeSelect defaultValue={editingUser.roles[0] || "viewer"} id={`roleCode-${editingUser.id}`} name="roleCode">
                        {roleCodes.map((roleCode) => (
                          <option key={roleCode} value={roleCode}>
                            {roleCode}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className={styles.inlineActions}>
                      <Button size="sm" type="submit" variant="secondary">
                        更新角色
                      </Button>
                    </div>
                  </form>

                  <form action={`/admin/users/${editingUser.id}/scopes`} className={styles.userForm} method="post">
                    <div className={styles.formGrid}>
                      <div className="field">
                        <label htmlFor={`enterpriseScopeIds-${editingUser.id}`}>企业范围</label>
                        <Input
                          defaultValue={editingUser.enterpriseScopeIds.join(",")}
                          id={`enterpriseScopeIds-${editingUser.id}`}
                          name="enterpriseScopeIds"
                          placeholder="enterprise_id,enterprise_id"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`organizationScopeIds-${editingUser.id}`}>组织范围</label>
                        <Input
                          defaultValue={editingUser.organizationScopeIds.join(",")}
                          id={`organizationScopeIds-${editingUser.id}`}
                          name="organizationScopeIds"
                          placeholder="organize_code,organize_code"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`storeScopeIds-${editingUser.id}`}>门店范围</label>
                        <Input
                          defaultValue={editingUser.storeScopeIds.join(",")}
                          id={`storeScopeIds-${editingUser.id}`}
                          name="storeScopeIds"
                          placeholder="store_id,store_id"
                        />
                      </div>
                    </div>
                    <div className={styles.inlineActions}>
                      <Button size="sm" type="submit" variant="secondary">
                        更新范围
                      </Button>
                    </div>
                  </form>
                </section>

                <section className={styles.editSection}>
                  <h3 className={styles.editSectionTitle}>账号操作</h3>
                  <form action={`/admin/users/${editingUser.id}/password`} className={styles.singleActionForm} method="post">
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
                    <div className={styles.inlineActions}>
                      <Button size="sm" type="submit" variant="secondary">
                        重置密码
                      </Button>
                    </div>
                  </form>

                  <form action={`/admin/users/${editingUser.id}/status`} className={styles.singleActionForm} method="post">
                    <input name="status" type="hidden" value={editingUser.status === "active" ? "disabled" : "active"} />
                    <div className={styles.statusRow}>
                      <Badge className={cn(styles.statusBadge, statusBadgeClass(editingUser.status))} variant="secondary">
                        {editingUser.status}
                      </Badge>
                      <Button size="sm" type="submit" variant="secondary">
                        {editingUser.status === "active" ? "禁用账号" : "启用账号"}
                      </Button>
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
