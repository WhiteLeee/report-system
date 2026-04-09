import Link from "next/link";
import { redirect } from "next/navigation";

import { createAuthService } from "@/backend/auth/auth.module";
import { requirePermission } from "@/backend/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { SystemManagementTabs } from "@/ui/shared/system-management-tabs";

export const dynamic = "force-dynamic";

const authService = createAuthService();
const pageSizeOptions = [20, 50, 100] as const;

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

function formatDateLabel(value: string): string {
  if (!value) {
    return "-";
  }
  return value.includes("T") ? value.replace("T", " ").slice(0, 16) : value.slice(0, 16);
}

function toAuditQuery(
  current: Record<string, string | string[] | undefined>,
  updates: Record<string, string>
): string {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });
  Object.entries(updates).forEach(([key, value]) => {
    const normalized = value.trim();
    if (!normalized) {
      params.delete(key);
      return;
    }
    params.set(key, normalized);
  });
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("user:read", "/admin/audit");
  if (!currentUser.roles.includes("admin")) {
    redirect("/reports");
  }
  const resolvedSearchParams = await searchParams;
  const auditAction = normalizeQueryValue(resolvedSearchParams.auditAction);
  const auditKeyword = decodeQueryValue(normalizeQueryValue(resolvedSearchParams.auditKeyword));
  const requestedPage = Number.parseInt(normalizeQueryValue(resolvedSearchParams.page) || "1", 10);
  const requestedPageSize = Number.parseInt(
    normalizeQueryValue(resolvedSearchParams.pageSize) || String(pageSizeOptions[0]),
    10
  );
  const pageSize = pageSizeOptions.includes(requestedPageSize as (typeof pageSizeOptions)[number])
    ? requestedPageSize
    : pageSizeOptions[0];
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const auditLogPage = authService.queryAuditLogs({
    action: auditAction || undefined,
    keyword: auditKeyword || undefined,
    page,
    pageSize
  });
  const totalPages = Math.max(1, Math.ceil(auditLogPage.total / auditLogPage.pageSize));
  const actionOptions = Array.from(new Set(authService.listAuditLogs(300).map((item) => item.action).filter(Boolean))).sort();

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/admin/settings"
        currentUser={currentUser}
        subtitle="系统管理工作台"
        title="系统管理 / 操作审计"
      />

      <section className="section">
        <SystemManagementTabs activeTab="audit" />
      </section>

      <section className="section">
        <Card>
          <CardHeader>
            <CardTitle>审计流水</CardTitle>
            <CardDescription>记录用户与权限关键操作，支持按动作和关键字筛选。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/admin/audit" className="grid gap-3 md:grid-cols-[1fr_2fr_auto]" method="get">
              <div className="field">
                <label htmlFor="auditAction">操作动作</label>
                <NativeSelect defaultValue={auditAction} id="auditAction" name="auditAction">
                  <option value="">全部动作</option>
                  {actionOptions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="field">
                <label htmlFor="auditKeyword">关键字</label>
                <Input defaultValue={auditKeyword} id="auditKeyword" name="auditKeyword" placeholder="操作人、目标账号、请求ID、IP" />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" type="submit">
                  筛选
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/audit">重置</Link>
                </Button>
              </div>
              <input name="page" type="hidden" value="1" />
              <input name="pageSize" type="hidden" value={String(auditLogPage.pageSize)} />
            </form>

            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100/80 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">时间</th>
                    <th className="px-3 py-2 text-left font-medium">操作人</th>
                    <th className="px-3 py-2 text-left font-medium">目标账号</th>
                    <th className="px-3 py-2 text-left font-medium">动作</th>
                    <th className="px-3 py-2 text-left font-medium">来源</th>
                    <th className="px-3 py-2 text-left font-medium">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogPage.items.length > 0 ? (
                    auditLogPage.items.map((log) => (
                      <tr className="border-t border-zinc-200 align-top" key={log.id}>
                        <td className="px-3 py-2">{formatDateLabel(log.createdAt)}</td>
                        <td className="px-3 py-2">{log.operatorUsername || "-"}</td>
                        <td className="px-3 py-2">{log.targetUsername || "-"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{log.action}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-500">
                          <div>req: {log.requestId || "-"}</div>
                          <div>ip: {log.ipAddress || "-"}</div>
                        </td>
                        <td className="px-3 py-2">
                          <details className="rounded-lg border border-zinc-200 p-2">
                            <summary className="cursor-pointer text-zinc-700">查看</summary>
                            <div className="mt-2 space-y-2 text-xs">
                              <div>
                                <strong>before</strong>
                                <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-100 p-2 text-[11px] leading-5">
                                  {log.beforeJson || "{}"}
                                </pre>
                              </div>
                              <div>
                                <strong>after</strong>
                                <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-100 p-2 text-[11px] leading-5">
                                  {log.afterJson || "{}"}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-8 text-center text-zinc-500" colSpan={6}>
                        当前筛选条件下没有审计记录。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-zinc-600">
                共 {auditLogPage.total} 条，第 {auditLogPage.page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <Button asChild disabled={auditLogPage.page <= 1} size="sm" variant="secondary">
                  <Link
                    href={toAuditQuery(resolvedSearchParams, {
                      page: String(Math.max(1, auditLogPage.page - 1)),
                      pageSize: String(auditLogPage.pageSize)
                    })}
                  >
                    上一页
                  </Link>
                </Button>
                <Button asChild disabled={auditLogPage.page >= totalPages} size="sm" variant="secondary">
                  <Link
                    href={toAuditQuery(resolvedSearchParams, {
                      page: String(Math.min(totalPages, auditLogPage.page + 1)),
                      pageSize: String(auditLogPage.pageSize)
                    })}
                  >
                    下一页
                  </Link>
                </Button>
              </div>
            </div>

            <form action="/admin/audit" className="flex items-end gap-2" method="get">
              <input name="auditAction" type="hidden" value={auditAction} />
              <input name="auditKeyword" type="hidden" value={auditKeyword} />
              <input name="page" type="hidden" value="1" />
              <div className="field max-w-[180px]">
                <label htmlFor="pageSize">每页显示</label>
                <NativeSelect defaultValue={String(auditLogPage.pageSize)} id="pageSize" name="pageSize">
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button size="sm" type="submit" variant="secondary">
                应用
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
