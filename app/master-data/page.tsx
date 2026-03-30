import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./master-data-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createMasterDataService } from "@/backend/master-data/master-data.module";
import type { MasterDataOrganization, MasterDataStore } from "@/backend/master-data/master-data.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DashboardHeader } from "@/ui/dashboard-header";

export const dynamic = "force-dynamic";

const masterDataService = createMasterDataService();
const PAGE_SIZE_OPTIONS = [20, 50, 100, 500];

function normalizeQueryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function formatDateLabel(value: string): string {
  if (!value) {
    return "-";
  }
  return value.includes("T") ? value.replace("T", " ").slice(0, 16) : value.slice(0, 16);
}

function buildQueryString(params: Record<string, string>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `/master-data?${query}` : "/master-data";
}

function flattenOrganizations(nodes: MasterDataOrganization[]): Array<{ code: string; name: string }> {
  const items: Array<{ code: string; name: string }> = [];
  const walk = (rows: MasterDataOrganization[]) => {
    rows.forEach((row) => {
      items.push({ code: row.organize_code, name: row.organize_name });
      if (row.child.length > 0) {
        walk(row.child);
      }
    });
  };
  walk(nodes);
  return items;
}

function filterOrganizationTree(nodes: MasterDataOrganization[], keyword: string): MasterDataOrganization[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return nodes;
  }

  return nodes
    .map((node) => {
      const child = filterOrganizationTree(node.child, normalizedKeyword);
      const match =
        node.organize_name.toLowerCase().includes(normalizedKeyword) ||
        node.organize_code.toLowerCase().includes(normalizedKeyword);
      if (!match && child.length === 0) {
        return null;
      }
      return {
        ...node,
        child
      };
    })
    .filter((node): node is MasterDataOrganization => Boolean(node));
}

function renderStoreStatus(value: string): ReactNode {
  const normalized = value.trim();
  if (!normalized) {
    return "-";
  }
  const lower = normalized.toLowerCase();
  let className = styles.statusNeutral;
  if (["营业", "正常", "active", "zc"].includes(normalized) || lower === "active") {
    className = styles.statusSuccess;
  } else if (["闭店", "停业", "inactive", "bd", "ty"].includes(normalized) || lower === "inactive") {
    className = styles.statusDanger;
  } else if (["未开业", "筹备中", "no"].includes(normalized)) {
    className = styles.statusWarning;
  }
  return <span className={className}>{normalized}</span>;
}

function renderDocStatus(value: string): ReactNode {
  const normalized = value.trim();
  if (!normalized) {
    return "-";
  }
  if (normalized === "zc") {
    return <span className={styles.statusSuccess}>正常</span>;
  }
  if (normalized === "lq") {
    return <span className={styles.statusWarning}>临期</span>;
  }
  if (normalized === "gq") {
    return <span className={styles.statusDanger}>过期</span>;
  }
  if (normalized === "no") {
    return <span className={styles.statusNeutral}>缺失</span>;
  }
  return <span className={styles.statusNeutral}>{normalized}</span>;
}

function renderOrganizationTree(
  nodes: MasterDataOrganization[],
  buildHref: (organizeCode: string) => string,
  selectedCode: string
): ReactNode {
  return (
    <ul className={styles.orgTree}>
      {nodes.map((node) => (
        <li className={styles.orgNode} key={node.organize_code}>
          <Link
            className={node.organize_code === selectedCode ? `${styles.orgRow} ${styles.orgRowActive}` : styles.orgRow}
            href={buildHref(node.organize_code)}
          >
            <span className={styles.orgName}>{node.organize_name}</span>
            <span className={styles.orgCount}>{node.current_store_count}</span>
          </Link>
          {node.child.length > 0 ? renderOrganizationTree(node.child, buildHref, selectedCode) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function MasterDataPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read", "/master-data");
  const resolvedSearchParams = await searchParams;

  const enterprise = normalizeQueryValue(resolvedSearchParams.enterprise);
  const organizeCode = normalizeQueryValue(resolvedSearchParams.organizeCode);
  const keyword = normalizeQueryValue(resolvedSearchParams.keyword);
  const status = normalizeQueryValue(resolvedSearchParams.status);
  const orgKeyword = normalizeQueryValue(resolvedSearchParams.orgKeyword);
  const requestedPage = Number.parseInt(normalizeQueryValue(resolvedSearchParams.page) || "1", 10);
  const requestedPageSize = Number.parseInt(normalizeQueryValue(resolvedSearchParams.pageSize) || "20", 10);

  const context = {
    enterpriseScopeIds: currentUser.enterpriseScopeIds,
    organizationScopeIds: currentUser.organizationScopeIds,
    storeScopeIds: currentUser.storeScopeIds
  };

  const enterprises = masterDataService.listEnterprises(context);
  const activeEnterprise = enterprise || enterprises[0]?.enterprise_id || "";
  const organizations = activeEnterprise ? masterDataService.listOrganizations(activeEnterprise, context) : [];
  const organizationOptions = flattenOrganizations(organizations);
  const filteredTree = filterOrganizationTree(organizations, orgKeyword);
  const currentEnterprise = enterprises.find((item) => item.enterprise_id === activeEnterprise) ?? null;
  const latestLogs = activeEnterprise ? masterDataService.listSyncLogs(activeEnterprise, 5, context) : [];
  const latestLog = latestLogs[0] ?? null;
  const storeUniverse = activeEnterprise ? masterDataService.listStores({ enterpriseId: activeEnterprise }, context) : [];
  const filteredStores = activeEnterprise
    ? masterDataService.listStores(
        {
          enterpriseId: activeEnterprise,
          organizeCode,
          keyword,
          status
        },
        context
      )
    : [];
  const statusOptions = Array.from(new Set(storeUniverse.map((item) => item.status).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 20;
  const total = filteredStores.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1), totalPages);
  const pageStart = (page - 1) * pageSize;
  const pagedStores = filteredStores.slice(pageStart, pageStart + pageSize);
  const selectedOrganizationName =
    organizationOptions.find((item) => item.code === organizeCode)?.name || (organizeCode ? organizeCode : "全部组织");

  const commonParams = {
    enterprise: activeEnterprise,
    organizeCode,
    keyword,
    status,
    orgKeyword,
    pageSize: String(pageSize)
  };

  return (
    <main className="page-shell">
      <DashboardHeader currentUser={currentUser} subtitle="按 vision-agent 的主数据结构保存并展示当前企业的组织树与门店台账。" title="门店主数据" />

      <section className={styles.panel}>
        <form className={styles.searchBar} method="get">
          <div className={styles.searchField}>
            <label htmlFor="enterprise">企业</label>
            <NativeSelect defaultValue={activeEnterprise} id="enterprise" name="enterprise">
              {enterprises.map((item) => (
                <option key={item.enterprise_id} value={item.enterprise_id}>
                  {item.enterprise_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className={styles.searchField}>
            <label htmlFor="organizeCode">运营组织</label>
            <NativeSelect defaultValue={organizeCode} id="organizeCode" name="organizeCode">
              <option value="">全部组织</option>
              {organizationOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className={styles.searchField}>
            <label htmlFor="keyword">名称/编码</label>
            <Input defaultValue={keyword} id="keyword" name="keyword" placeholder="输入门店名称或门店编码" />
          </div>
          <div className={styles.searchField}>
            <label htmlFor="status">门店状态</label>
            <NativeSelect defaultValue={status} id="status" name="status">
              <option value="">全部状态</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className={styles.searchActions}>
            <Button size="sm" type="submit">
              查询
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/master-data">重置</Link>
            </Button>
          </div>
        </form>

        <div className={styles.summaryStrip}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>最近接收快照</div>
            <div className={styles.summaryValue}>
              {currentEnterprise?.latest_snapshot_version ? `快照 ${currentEnterprise.latest_snapshot_version}` : "暂无接收记录"}
            </div>
            <div className={styles.summaryMeta}>
              {currentEnterprise
                ? `组织数：${currentEnterprise.organize_count} · 门店数：${currentEnterprise.store_count} · 更新时间：${formatDateLabel(currentEnterprise.latest_published_at)}`
                : "请选择企业查看主数据快照。"}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>最近接收结果</div>
            <div className={styles.summaryValue}>{latestLog ? `已接收 / ${latestLog.snapshot_version}` : "暂无批次"}</div>
            <div className={styles.summaryMeta}>
              {latestLog
                ? `发布时间：${formatDateLabel(latestLog.published_at)} · 组织数：${latestLog.organize_count} · 门店数：${latestLog.store_count}`
                : "等待 vision-agent 发布主数据快照。"}
            </div>
          </div>
        </div>

        <div className={styles.bodyWrap}>
          <aside className={styles.orgPane}>
            <form className={styles.orgSearchBar} method="get">
              <input name="enterprise" type="hidden" value={activeEnterprise} />
              <input name="organizeCode" type="hidden" value={organizeCode} />
              <input name="keyword" type="hidden" value={keyword} />
              <input name="status" type="hidden" value={status} />
              <input name="pageSize" type="hidden" value={String(pageSize)} />
              <Input defaultValue={orgKeyword} name="orgKeyword" placeholder="搜索组织名称" />
              <Button size="sm" type="submit" variant="secondary">
                筛选
              </Button>
            </form>
            <div className={styles.orgTreeWrap}>
              <Link
                className={!organizeCode ? `${styles.orgRow} ${styles.orgRowActive}` : styles.orgRow}
                href={buildQueryString({
                  ...commonParams,
                  organizeCode: "",
                  page: "1"
                })}
              >
                <span className={styles.orgName}>全部组织</span>
                <span className={styles.orgCount}>{storeUniverse.length}</span>
              </Link>
              {filteredTree.length > 0 ? (
                renderOrganizationTree(
                  filteredTree,
                  (nextOrganizeCode) =>
                    buildQueryString({
                      ...commonParams,
                      organizeCode: nextOrganizeCode,
                      page: "1"
                    }),
                  organizeCode
                )
              ) : (
                <div className={styles.empty}>暂无组织数据</div>
              )}
            </div>
          </aside>

          <div className={styles.contentPane}>
            <div className={styles.contentHead}>
              <div>
                <strong>门店信息</strong>
                <div className={styles.muted}>
                  当前范围：{selectedOrganizationName} · 共 {total} 家门店
                </div>
              </div>
            </div>

            <div className={styles.tableWrap}>
              {pagedStores.length > 0 ? (
                <table className={styles.storeTable}>
                  <thead>
                    <tr>
                      <th>门店名称</th>
                      <th>门店编号</th>
                      <th>门店类型</th>
                      <th>运营组织</th>
                      <th>加盟商名称</th>
                      <th>员工数量</th>
                      <th>负责督导</th>
                      <th>门店状态</th>
                      <th>营业执照</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStores.map((item) => (
                      <tr key={item.store_id}>
                        <td title={item.store_name}>{item.store_name}</td>
                        <td>{item.store_code || item.store_id}</td>
                        <td>{item.store_type || "-"}</td>
                        <td title={item.organize_name}>{item.organize_name || item.organize_code || "-"}</td>
                        <td title={item.franchisee_name}>{item.franchisee_name || "-"}</td>
                        <td>{item.emp_count || 0}</td>
                        <td title={item.employee_name || item.supervisor}>{item.employee_name || item.supervisor || "-"}</td>
                        <td>{renderStoreStatus(item.status)}</td>
                        <td>{renderDocStatus(item.business_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={styles.empty}>当前筛选条件下没有可展示的门店主数据。</div>
              )}
            </div>

            <div className={styles.pager}>
              <form className={styles.pagerLeft} method="get">
                <input name="enterprise" type="hidden" value={activeEnterprise} />
                <input name="organizeCode" type="hidden" value={organizeCode} />
                <input name="keyword" type="hidden" value={keyword} />
                <input name="status" type="hidden" value={status} />
                <input name="orgKeyword" type="hidden" value={orgKeyword} />
                <span className={styles.muted}>共 {total} 条</span>
                <label className={styles.muted} htmlFor="pageSize">
                  每页
                </label>
                <NativeSelect defaultValue={String(pageSize)} id="pageSize" name="pageSize">
                  {PAGE_SIZE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </NativeSelect>
                <Button size="sm" type="submit" variant="secondary">
                  应用
                </Button>
              </form>

              <div className={styles.pagerRight}>
                <span className={styles.muted}>
                  第 {page} / {totalPages} 页
                </span>
                <Button asChild disabled={page <= 1} size="sm" variant="secondary">
                  <Link
                    aria-disabled={page <= 1}
                    href={buildQueryString({
                      ...commonParams,
                      page: String(Math.max(1, page - 1))
                    })}
                  >
                    上一页
                  </Link>
                </Button>
                <Button asChild disabled={page >= totalPages} size="sm" variant="secondary">
                  <Link
                    aria-disabled={page >= totalPages}
                    href={buildQueryString({
                      ...commonParams,
                      page: String(Math.min(totalPages, page + 1))
                    })}
                  >
                    下一页
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
