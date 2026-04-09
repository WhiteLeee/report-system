import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "./admin-users-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createAuthService } from "@/backend/auth/auth.module";
import { roleCodes } from "@/backend/auth/auth.types";
import { filterVisibleUsers, getCurrentDeliveryMode } from "@/backend/auth/user-management-policy";
import { createMasterDataService } from "@/backend/master-data/master-data.module";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { MasterDataEnterpriseSummary } from "@/backend/master-data/master-data.types";
import type { MasterDataOrganization } from "@/backend/master-data/master-data.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { AccessManagementTabs } from "@/ui/shared/access-management-tabs";

export const dynamic = "force-dynamic";

const authService = createAuthService();
const masterDataService = createMasterDataService();
const systemSettingsService = createSystemSettingsService();

interface OrganizationTreeGroup {
  enterpriseId: string;
  enterpriseLabel: string;
  nodes: MasterDataOrganization[];
}

function statusBadgeClass(status: string): string {
  return status === "active" ? styles.activeBadge : styles.disabledBadge;
}

function normalizeQueryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeQueryValue(value: string): string {
  if (!value) {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

function enterpriseSummariesFromContext(
  currentUser: Awaited<ReturnType<typeof requirePermission>>,
  enterprises: MasterDataEnterpriseSummary[]
): Array<{ value: string; label: string }> {
  if (enterprises.length > 0) {
    return enterprises.map((enterprise) => ({
      value: enterprise.enterprise_id,
      label: enterprise.enterprise_name || enterprise.enterprise_id
    }));
  }

  return currentUser.enterpriseScopeIds.map((enterpriseId) => ({
    value: enterpriseId,
    label: enterpriseId
  }));
}

function buildOrganizationTreeGroups(
  currentUser: Awaited<ReturnType<typeof requirePermission>>,
  enterprises: MasterDataEnterpriseSummary[]
): OrganizationTreeGroup[] {
  return enterpriseSummariesFromContext(currentUser, enterprises)
    .map((enterprise) => ({
      enterpriseId: enterprise.value,
      enterpriseLabel: enterprise.label,
      nodes: sortOrganizationTree(masterDataService.listOrganizations(enterprise.value, currentUser))
    }))
    .filter((item) => item.nodes.length > 0);
}

function renderOrganizationNode(
  node: MasterDataOrganization,
  fieldName: string,
  selectedValues: Set<string>,
  depth: number
) {
  const hasChildren = node.child.length > 0;
  const itemValue = `${fieldName}-${node.organize_code}`;
  const row = (
    <label className={styles.organizationNodeLabel}>
      <input
        className={styles.scopeCheckbox}
        defaultChecked={selectedValues.has(node.organize_code)}
        name={fieldName}
        type="checkbox"
        value={node.organize_code}
      />
      <span className={styles.scopeOptionBody}>
        <span className={styles.scopeOptionLabel}>{node.organize_name}</span>
        <span className={styles.scopeOptionMeta}>{node.current_store_count} 家门店</span>
      </span>
    </label>
  );

  if (!hasChildren) {
    return (
      <div className={styles.organizationLeafNode} key={itemValue} style={{ marginLeft: `${depth * 16}px` }}>
        {row}
      </div>
    );
  }

  return (
    <Accordion className={styles.organizationNode} collapsible key={itemValue} type="single">
      <AccordionItem className={styles.organizationAccordionItem} value={itemValue}>
        <div className={styles.organizationNodeHeader} style={{ marginLeft: `${depth * 16}px` }}>
          {row}
          <AccordionTrigger className={styles.organizationNodeTrigger}>展开子组织</AccordionTrigger>
        </div>
        <AccordionContent className={styles.organizationChildren}>
          {node.child.map((child) => renderOrganizationNode(child, fieldName, selectedValues, depth + 1))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function renderOrganizationScopeTree(
  treeGroups: OrganizationTreeGroup[],
  selectedValues: string[],
  emptyCopy: string
) {
  const selected = new Set(selectedValues);
  return (
    <section className={styles.scopeField}>
      <div className={styles.scopeFieldHeader}>
        <h4 className={styles.scopeFieldTitle}>组织范围</h4>
        <p className={styles.scopeFieldCopy}>单租户默认企业范围全可见；勾选组织树可精细控制范围。不勾选表示全部组织可见。</p>
      </div>
      {treeGroups.length > 0 ? (
        <div className={styles.scopePicker}>
          {treeGroups.map((group) => (
            <div className={styles.organizationGroup} key={group.enterpriseId}>
              <div className={styles.organizationGroupTitle}>{group.enterpriseLabel}</div>
              <div className={styles.organizationTree}>
                {group.nodes.map((node) => renderOrganizationNode(node, "organizationScopeIds", selected, 0))}
              </div>
            </div>
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
  const currentUser = await requirePermission("user:read", "/admin/users");
  if (!currentUser) {
    redirect("/reports");
  }
  const canWriteUsers = currentUser.permissions.includes("user:write");
  const canWriteRoles = currentUser.permissions.includes("role:write");
  const canWriteScopes = currentUser.permissions.includes("scope:write");
  const canOpenEditDialog = canWriteUsers || canWriteRoles || canWriteScopes;
  const deliveryMode = getCurrentDeliveryMode();
  const users = filterVisibleUsers(authService.listUsers(), deliveryMode, currentUser);
  const availableRoleCodes = roleCodes.filter((code) => code !== "admin");
  const resolvedSearchParams = await searchParams;
  const dialog = normalizeQueryValue(resolvedSearchParams.dialog);
  const actionError = decodeQueryValue(normalizeQueryValue(resolvedSearchParams.error));
  const isErrorDialogOpen = Boolean(actionError);
  const editingUserId = Number(normalizeQueryValue(resolvedSearchParams.userId));
  const editingUser = Number.isInteger(editingUserId) ? users.find((user) => user.id === editingUserId) ?? null : null;
  const isCreateDialogOpen = dialog === "create" && canWriteUsers;
  const isEditDialogOpen = dialog === "edit" && !!editingUser && canOpenEditDialog;
  const securityPolicy = systemSettingsService.getAuthSecurityPolicy();
  const enterprises = masterDataService.listEnterprises(currentUser);
  const organizationTreeGroups = buildOrganizationTreeGroups(currentUser, enterprises);

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/admin/users"
        currentUser={currentUser}
        subtitle="独立管理用户账号、角色和授权范围。"
        title="用户管理"
      />

      <section className="section">
        <AccessManagementTabs activeTab="users" />
      </section>

      <section className="section">
        <Card className={styles.workspaceCard}>
          <CardHeader className={styles.workspaceHeader}>
            <div>
              <CardTitle className={styles.workspaceTitle}>用户列表</CardTitle>
              <CardDescription className={styles.workspaceCopy}>
                先查看当前用户清单，再通过弹窗完成新增和修改，不再把所有操作揉在主页面里。
              </CardDescription>
            </div>
            {canWriteUsers ? (
              <Button asChild>
                <Link href="/admin/users?dialog=create">新增用户</Link>
              </Button>
            ) : null}
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
                          {canOpenEditDialog ? (
                            <Button asChild className={styles.inlineActionButton} size="sm" variant="secondary">
                              <Link href={`/admin/users?dialog=edit&userId=${user.id}`}>编辑</Link>
                            </Button>
                          ) : (
                            <span className={styles.cellMeta}>-</span>
                          )}
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
                <div className={styles.formSection}>
                  <div className={styles.editCardHeader}>
                    <h3 className={styles.editSectionTitle}>基础信息</h3>
                    <p className={styles.editSectionCopy}>填写账号信息并分配初始角色。</p>
                  </div>
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
                      <Input id="password" minLength={securityPolicy.passwordMinLength} name="password" required type="password" />
                    </div>
                    <div className="field">
                      <label htmlFor="roleCode">角色</label>
                      <NativeSelect defaultValue="viewer" id="roleCode" name="roleCode">
                        {availableRoleCodes.map((roleCode) => (
                          <option key={roleCode} value={roleCode}>
                            {roleCode}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </div>
                <div className={styles.formSection}>
                  {renderOrganizationScopeTree(organizationTreeGroups, [], "当前没有可选择的组织范围。")}
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
                    在同一表单中统一维护角色、账号和组织授权。
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
            </CardHeader>
            <CardContent className={styles.modalBody}>
              <form action={`/admin/users/${editingUser.id}/update`} className={styles.userForm} method="post">
                <div className={styles.editLayout}>
                  <div className={styles.sideRail}>
                    <section className={styles.editCard}>
                      <div className={styles.editCardHeader}>
                        <h3 className={styles.editSectionTitle}>角色与状态</h3>
                        <p className={styles.editSectionCopy}>角色和状态放在同一个区域集中调整。</p>
                      </div>
                      <div className={styles.cardForm}>
                        <div className="field">
                          <label htmlFor={`roleCode-${editingUser.id}`}>角色</label>
                          {canWriteRoles && !editingUser.roles.includes("admin") ? (
                            <NativeSelect defaultValue={editingUser.roles[0] || "viewer"} id={`roleCode-${editingUser.id}`} name="roleCode">
                              {availableRoleCodes.map((roleCode) => (
                                <option key={roleCode} value={roleCode}>
                                  {roleCode}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : (
                            <Input disabled readOnly value={editingUser.roles[0] || "admin"} />
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor={`status-${editingUser.id}`}>账号状态</label>
                          {canWriteUsers ? (
                            <NativeSelect defaultValue={editingUser.status} id={`status-${editingUser.id}`} name="status">
                              <option value="active">active</option>
                              <option value="disabled">disabled</option>
                            </NativeSelect>
                          ) : (
                            <Input disabled readOnly value={editingUser.status} />
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor={`password-${editingUser.id}`}>新密码（可选）</label>
                          <Input
                            id={`password-${editingUser.id}`}
                            minLength={securityPolicy.passwordMinLength}
                            name="password"
                            placeholder={`不修改请留空；最少 ${securityPolicy.passwordMinLength} 位`}
                            type="password"
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <section className={`${styles.editCard} ${styles.scopeCard}`}>
                    <div className={styles.editCardHeader}>
                      <h3 className={styles.editSectionTitle}>组织范围授权</h3>
                      <p className={styles.editSectionCopy}>单租户默认企业全可见；按组织树勾选授权范围。</p>
                    </div>
                    {canWriteScopes ? (
                      renderOrganizationScopeTree(
                        organizationTreeGroups,
                        editingUser.organizationScopeIds,
                        "当前没有可选择的组织范围。"
                      )
                    ) : (
                      <p className={styles.editSectionCopy}>当前账号无范围授权权限。</p>
                    )}
                  </section>
                </div>
                <div className={styles.formActions}>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/admin/users">取消</Link>
                  </Button>
                  <Button size="sm" type="submit">
                    保存修改
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isErrorDialogOpen ? (
        <div className={styles.modalOverlay}>
          <Link aria-label="关闭错误提示弹窗" className={styles.modalBackdrop} href="/admin/users" />
          <Link aria-label="关闭错误提示弹窗" className={styles.modalCloseArea} href="/admin/users" />
          <Card className={`${styles.modalCard} ${styles.confirmCard}`}>
            <CardHeader className={styles.modalHeader}>
              <div>
                <CardTitle className={styles.modalTitle}>提交失败</CardTitle>
                <CardDescription className={styles.modalCopy}>请修正输入后重新提交。</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={styles.confirmBody}>
              <div className={styles.errorDialogMessage}>{actionError}</div>
              <div className={styles.formActions}>
                <Button asChild size="sm">
                  <Link href="/admin/users">我知道了</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
