import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "./master-data-page.module.css";
import { MasterDataPagination } from "./master-data-pagination";

import { requirePermission } from "@/backend/auth/session";
import { createMasterDataService } from "@/backend/master-data/master-data.module";
import type { MasterDataOrganization, MasterDataStore } from "@/backend/master-data/master-data.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { SystemManagementTabs } from "@/ui/shared/system-management-tabs";

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

function findOrganizationPath(nodes: MasterDataOrganization[], targetCode: string): MasterDataOrganization[] {
  for (const node of nodes) {
    if (node.organize_code === targetCode) {
      return [node];
    }
    if (node.child.length > 0) {
      const childPath = findOrganizationPath(node.child, targetCode);
      if (childPath.length > 0) {
        return [node, ...childPath];
      }
    }
  }
  return [];
}

function collectOrganizationCodes(node: MasterDataOrganization): string[] {
  return [node.organize_code, ...node.child.flatMap((child) => collectOrganizationCodes(child))];
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
  options: {
    buildHref: (organizeCode: string) => string;
    buildToggleHref: (organizeCode: string, shouldExpand: boolean) => string;
    selectedCode: string;
    expandedCodes: Set<string>;
    forcedOpenCodes: Set<string>;
  }
): ReactNode {
  return (
    <ul className={styles.orgTree}>
      {nodes.map((node) => (
        <li className={styles.orgNode} key={node.organize_code}>
          <div className={node.organize_code === options.selectedCode ? `${styles.orgRow} ${styles.orgRowActive}` : styles.orgRow}>
            {node.child.length > 0 ? (
              <Link
                aria-label={options.expandedCodes.has(node.organize_code) || options.forcedOpenCodes.has(node.organize_code) ? "收起组织" : "展开组织"}
                className={styles.orgToggle}
                href={options.buildToggleHref(
                  node.organize_code,
                  !(options.expandedCodes.has(node.organize_code) || options.forcedOpenCodes.has(node.organize_code))
                )}
              >
                {options.expandedCodes.has(node.organize_code) || options.forcedOpenCodes.has(node.organize_code) ? "▾" : "▸"}
              </Link>
            ) : (
              <span className={styles.orgTogglePlaceholder} />
            )}
            <Link className={styles.orgLink} href={options.buildHref(node.organize_code)}>
              <span className={styles.orgName}>{node.organize_name}</span>
              <span className={styles.orgCount}>{node.current_store_count}</span>
            </Link>
          </div>
          {node.child.length > 0 &&
          (options.expandedCodes.has(node.organize_code) || options.forcedOpenCodes.has(node.organize_code))
            ? renderOrganizationTree(node.child, options)
            : null}
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
  const currentUser = await requirePermission("master-data:read", "/master-data");
  if (!currentUser.roles.includes("admin")) {
    redirect("/reports");
  }
  const resolvedSearchParams = await searchParams;

  const enterprise = normalizeQueryValue(resolvedSearchParams.enterprise);
  const organizeCode = normalizeQueryValue(resolvedSearchParams.organizeCode);
  const keyword = normalizeQueryValue(resolvedSearchParams.keyword);
  const status = normalizeQueryValue(resolvedSearchParams.status);
  const orgKeyword = normalizeQueryValue(resolvedSearchParams.orgKeyword);
  const expanded = normalizeQueryValue(resolvedSearchParams.expanded);
  const requestedPage = Number.parseInt(normalizeQueryValue(resolvedSearchParams.page) || "1", 10);
  const requestedPageSize = Number.parseInt(normalizeQueryValue(resolvedSearchParams.pageSize) || "20", 10);

  const context = {
    enterpriseScopeIds: currentUser.enterpriseScopeIds,
    organizationScopeIds: currentUser.organizationScopeIds,
    storeScopeIds: currentUser.storeScopeIds
  };

  const enterprises = masterDataService.listEnterprises(context);
  const activeEnterprise = enterprise || enterprises[0]?.enterprise_id || "";
  const organizations = activeEnterprise ? sortOrganizationTree(masterDataService.listOrganizations(activeEnterprise, context)) : [];
  const organizationOptions = flattenOrganizations(organizations);
  const filteredTree = filterOrganizationTree(organizations, orgKeyword);
  const currentEnterprise = enterprises.find((item) => item.enterprise_id === activeEnterprise) ?? null;
  const latestLogs = activeEnterprise ? masterDataService.listSyncLogs(activeEnterprise, 5, context) : [];
  const latestLog = latestLogs[0] ?? null;
  const storeUniverse = activeEnterprise ? masterDataService.listStores({ enterpriseId: activeEnterprise }, context) : [];
  const selectedPath = organizeCode ? findOrganizationPath(organizations, organizeCode) : [];
  const selectedNode = selectedPath.at(-1);
  const selectedCodes = selectedNode ? new Set(collectOrganizationCodes(selectedNode)) : null;
  const expandedCodes = new Set(expanded.split(",").map((item) => item.trim()).filter(Boolean));
  const forcedOpenCodes = new Set(selectedPath.slice(0, -1).map((item) => item.organize_code));
  const filteredStores = storeUniverse.filter((item) => {
    if (selectedCodes && !selectedCodes.has(item.organize_code)) {
      return false;
    }
    if (status && item.status !== status) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const normalizedKeyword = keyword.toLowerCase();
    return item.store_name.toLowerCase().includes(normalizedKeyword) || item.store_code.toLowerCase().includes(normalizedKeyword);
  });
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
    expanded: Array.from(expandedCodes).join(","),
    pageSize: String(pageSize)
  };

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/master-data"
        currentUser={currentUser}
        subtitle="系统管理工作台"
        title="系统管理 / 门店主数据"
      />

      <section className="section">
        <SystemManagementTabs activeTab="master-data" />
      </section>

      <section className="section">
        <div className={styles.panel}>
          <form className={styles.searchBar} method="get">
            <input name="enterprise" type="hidden" value={activeEnterprise} />
            <input name="organizeCode" type="hidden" value={organizeCode} />
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
                    {
                      buildHref: (nextOrganizeCode) =>
                        buildQueryString({
                          ...commonParams,
                          organizeCode: nextOrganizeCode,
                          page: "1"
                        }),
                      buildToggleHref: (nextOrganizeCode, shouldExpand) => {
                        const nextExpanded = new Set(expandedCodes);
                        if (shouldExpand) {
                          nextExpanded.add(nextOrganizeCode);
                        } else {
                          nextExpanded.delete(nextOrganizeCode);
                        }
                        return buildQueryString({
                          ...commonParams,
                          expanded: Array.from(nextExpanded).join(","),
                          page: String(page)
                        });
                      },
                      selectedCode: organizeCode,
                      expandedCodes,
                      forcedOpenCodes
                    }
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
                  <Table className={styles.storeTable}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>门店名称</TableHead>
                        <TableHead>门店编号</TableHead>
                        <TableHead>门店类型</TableHead>
                        <TableHead>运营组织</TableHead>
                        <TableHead>加盟商名称</TableHead>
                        <TableHead>员工数量</TableHead>
                        <TableHead>负责督导</TableHead>
                        <TableHead>门店状态</TableHead>
                        <TableHead>营业执照</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedStores.map((item) => (
                        <TableRow key={item.store_id}>
                          <TableCell title={item.store_name}>{item.store_name}</TableCell>
                          <TableCell>{item.store_code || item.store_id}</TableCell>
                          <TableCell>{item.store_type || "-"}</TableCell>
                          <TableCell title={item.organize_name}>{item.organize_name || item.organize_code || "-"}</TableCell>
                          <TableCell title={item.franchisee_name}>{item.franchisee_name || "-"}</TableCell>
                          <TableCell>{item.emp_count || 0}</TableCell>
                          <TableCell title={item.employee_name || item.supervisor}>{item.employee_name || item.supervisor || "-"}</TableCell>
                          <TableCell>{renderStoreStatus(item.status)}</TableCell>
                          <TableCell>{renderDocStatus(item.business_status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className={styles.empty}>当前筛选条件下没有可展示的门店主数据。</div>
                )}
              </div>

              <MasterDataPagination
                page={page}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                total={total}
                totalPages={totalPages}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
