import Link from "next/link";

import styles from "./rectifications-page.module.css";

import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import type {
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DashboardHeader } from "@/ui/dashboard-header";
import { formatDisplayDate } from "@/ui/report-view";

export const dynamic = "force-dynamic";

const rectificationService = createRectificationService();

function buildFilters(searchParams: Record<string, string | string[] | undefined>): RectificationOrderFilters {
  return {
    keyword: typeof searchParams.keyword === "string" ? searchParams.keyword.trim() : "",
    status: typeof searchParams.status === "string" ? searchParams.status : "",
    ifCorrected: typeof searchParams.ifCorrected === "string" ? searchParams.ifCorrected : "",
    startDate: typeof searchParams.startDate === "string" ? searchParams.startDate : "",
    endDate: typeof searchParams.endDate === "string" ? searchParams.endDate : ""
  };
}

function formatRectificationState(order: RectificationOrderRecord): string {
  if (order.if_corrected === "1") {
    return "已整改";
  }
  if (order.if_corrected === "2") {
    return "待审核";
  }
  if (order.if_corrected === "0") {
    return "已下发";
  }
  if (order.status === "corrected") {
    return "已整改";
  }
  if (order.status === "pending_review") {
    return "待审核";
  }
  if (order.status === "sync_failed") {
    return "同步失败";
  }
  return "已下发";
}

function formatStateTone(order: RectificationOrderRecord): "default" | "secondary" | "outline" {
  if (order.if_corrected === "1" || order.status === "corrected") {
    return "secondary";
  }
  if (order.status === "sync_failed") {
    return "outline";
  }
  return "default";
}

export default async function RectificationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read", "/rectifications");
  const resolvedSearchParams = await searchParams;
  const filters = buildFilters(resolvedSearchParams);
  const requestContext = buildRequestContext(currentUser);
  const orders = rectificationService.listOrders(filters, requestContext);

  const totalOrders = orders.length;
  const correctedOrders = orders.filter((order) => order.if_corrected === "1" || order.status === "corrected").length;
  const pendingReviewOrders = orders.filter(
    (order) => order.if_corrected === "2" || order.status === "pending_review"
  ).length;
  const issuedOrders = orders.filter(
    (order) => !["1", "2"].includes(String(order.if_corrected || "")) && order.status !== "sync_failed"
  ).length;

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="查看当前权限范围内全部整改单及闭环状态。"
        title="整改单"
      />

      <section className={styles.workspaceHero}>
        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>整改单总数</span>
              <strong className={styles.statValue}>{totalOrders}</strong>
              <span className={styles.statNote}>当前筛选结果</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>已整改</span>
              <strong className={styles.statValue}>{correctedOrders}</strong>
              <span className={styles.statNote}>慧运营已完成闭环</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>待审核</span>
              <strong className={styles.statValue}>{pendingReviewOrders}</strong>
              <span className={styles.statNote}>等待复核确认</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>已下发</span>
              <strong className={styles.statValue}>{issuedOrders}</strong>
              <span className={styles.statNote}>尚未完成整改</span>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className={`section ${styles.workspaceSection}`}>
        <Card className={styles.workspacePanel}>
          <CardHeader className={styles.workspacePanelHeader}>
            <div>
              <CardTitle className={styles.listTitle}>整改单列表</CardTitle>
              <CardDescription className={styles.listCopy}>
                展示已下发到慧运营的整改单本地追踪记录，可按门店、状态和创建时间筛选。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={styles.workspacePanelBody}>
            <details className={styles.filterDisclosure}>
              <summary className={styles.filterDisclosureSummary}>
                <div>
                  <strong className={styles.filterDisclosureTitle}>筛选整改单</strong>
                </div>
                <div className={styles.filterDisclosureMeta}>
                  <span className={styles.filterToggleLabel}>展开筛选</span>
                </div>
              </summary>
              <div className={styles.filterDisclosureBody}>
                <form className={styles.sidebarForm} method="get">
                  <div className={styles.filterFormPanel}>
                    <div className={styles.filterFormRow}>
                      <div className={styles.sidebarGrid}>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="keyword">关键字</label>
                          <Input
                            className={styles.control}
                            defaultValue={filters.keyword}
                            id="keyword"
                            name="keyword"
                            placeholder="门店 / 编号 / 报告ID"
                          />
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="status">本地状态</label>
                          <NativeSelect className={styles.control} defaultValue={filters.status} id="status" name="status">
                            <option value="">全部状态</option>
                            <option value="created">已创建</option>
                            <option value="pending_review">待审核</option>
                            <option value="corrected">已整改</option>
                            <option value="sync_failed">同步失败</option>
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="ifCorrected">整改状态</label>
                          <NativeSelect
                            className={styles.control}
                            defaultValue={filters.ifCorrected}
                            id="ifCorrected"
                            name="ifCorrected"
                          >
                            <option value="">全部状态</option>
                            <option value="0">已下发</option>
                            <option value="2">待审核</option>
                            <option value="1">已整改</option>
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="startDate">开始日期</label>
                          <Input className={styles.control} defaultValue={filters.startDate} id="startDate" name="startDate" type="date" />
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="endDate">结束日期</label>
                          <Input className={styles.control} defaultValue={filters.endDate} id="endDate" name="endDate" type="date" />
                        </div>
                      </div>
                      <div className={styles.filterActions}>
                        <Button asChild className={styles.filterButton} size="sm" variant="secondary">
                          <Link href="/rectifications">重置</Link>
                        </Button>
                        <Button className={styles.filterButton} size="sm" type="submit">
                          筛选
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </details>

            {orders.length > 0 ? (
              <div className={styles.tableShell}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <colgroup>
                      <col className={styles.orderCol} />
                      <col className={styles.storeCol} />
                      <col className={styles.enterpriseCol} />
                      <col className={styles.stateCol} />
                      <col className={styles.dateCol} />
                      <col className={styles.operatorCol} />
                      <col className={styles.updatedCol} />
                      <col className={styles.actionCol} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>整改单</th>
                        <th>门店</th>
                        <th>所属报告</th>
                        <th>闭环状态</th>
                        <th>整改要求</th>
                        <th>创建人</th>
                        <th>更新时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>{order.huiyunying_order_id || `#${order.id}`}</strong>
                              <span className={styles.cellMeta}>本地记录 #{order.id}</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>{order.store_name || order.store_code || "-"}</strong>
                              <span className={styles.cellMeta}>
                                {order.store_code || order.store_id || "-"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>{order.enterprise_name || "未归档企业"}</strong>
                              <span className={styles.cellMeta}>
                                报告 #{order.report_id} / 结果 #{order.result_id}
                              </span>
                            </div>
                          </td>
                          <td>
                            <Badge variant={formatStateTone(order)}>{formatRectificationState(order)}</Badge>
                          </td>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>{order.should_corrected || "-"}</strong>
                              {order.real_corrected_time ? (
                                <span className={styles.cellMeta}>完成：{formatDisplayDate(order.real_corrected_time)}</span>
                              ) : (
                                <span className={styles.cellMeta}>创建：{formatDisplayDate(order.created_at)}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={styles.cellValue}>{order.created_by}</span>
                          </td>
                          <td>
                            <span className={styles.cellMeta}>
                              {formatDisplayDate(order.last_synced_at || order.updated_at)}
                            </span>
                          </td>
                          <td>
                            <Button asChild className={styles.inlineActionButton} variant="secondary">
                              <Link href={`/reports/${order.report_id}/results/${order.result_id}?panel=review`}>
                                查看详情
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState className={styles.emptyState}>当前没有匹配的整改单记录。</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
