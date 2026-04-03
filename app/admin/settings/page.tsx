import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./system-settings-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createAnalyticsJobService } from "@/backend/analytics/analytics.module";
import type { AnalyticsPipelineHealthItem } from "@/backend/analytics/jobs/analytics-job.types";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { HuiYunYingApiSettings } from "@/backend/system-settings/system-settings.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/ui/dashboard-header";
import { formatDisplayDate } from "@/ui/report-view";
import { SystemManagementTabs } from "@/ui/system-management-tabs";

export const dynamic = "force-dynamic";

const systemSettingsService = createSystemSettingsService();
const analyticsJobService = createAnalyticsJobService();
const rectificationService = createRectificationService();

const tabs = [
  { key: "api", label: "API 基础设置", description: "维护慧运营 API 访问地址、Route、鉴权和限流参数。" },
  { key: "rectification", label: "整改单设置", description: "维护整改单创建、同步与约束参数。" },
  { key: "analytics", label: "分析任务设置", description: "维护 facts / snapshots 定时刷新间隔。" }
] as const;

type SettingsTab = (typeof tabs)[number]["key"];

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return value.includes("T") ? value.replace("T", " ").slice(0, 16) : value.slice(0, 16);
}

function analyticsJobLabel(jobType: AnalyticsPipelineHealthItem["job_type"]): string {
  if (jobType === "result_fact_rebuild") {
    return "分析事实刷新";
  }
  return "日快照刷新";
}

function analyticsJobDescription(jobType: AnalyticsPipelineHealthItem["job_type"]): string {
  if (jobType === "result_fact_rebuild") {
    return "把巡检结果、问题项、复核和整改单同步成分析事实数据。";
  }
  return "把分析事实汇总成按天统计的概览与趋势快照。";
}

function healthTone(status: AnalyticsPipelineHealthItem["status"]): "default" | "secondary" | "outline" {
  if (status === "healthy") {
    return "secondary";
  }
  if (status === "failed") {
    return "default";
  }
  return "outline";
}

function resolveTab(raw: string | string[] | undefined): SettingsTab {
  const value = typeof raw === "string" ? raw.trim() : "";
  return tabs.some((item) => item.key === value) ? (value as SettingsTab) : "api";
}

function FormShell({
  children,
  tab
}: {
  children: ReactNode;
  tab: SettingsTab;
}) {
  return (
    <form action="/admin/settings/save" className={styles.settingsForm} method="post">
      <input name="tab" type="hidden" value={tab} />
      {children}
    </form>
  );
}

function ApiSettingsForm({ settings }: { settings: HuiYunYingApiSettings }) {
  return (
    <FormShell tab="api">
      <div className={styles.formGrid}>
        <div className="field">
          <label htmlFor="uri">URI</label>
          <Input defaultValue={settings.uri} id="uri" name="uri" placeholder="https://api.example.com" required />
        </div>
        <div className="field">
          <label htmlFor="route">Route</label>
          <Input defaultValue={settings.route} id="route" name="route" placeholder="ruipos" required />
        </div>
        <div className="field">
          <label htmlFor="appid">App ID</label>
          <Input defaultValue={settings.appid} id="appid" name="appid" placeholder="请输入 appid" required />
        </div>
        <div className="field">
          <label htmlFor="secret">Secret</label>
          <Input defaultValue={settings.secret} id="secret" name="secret" placeholder="请输入 secret" required type="password" />
        </div>
        <div className="field">
          <label htmlFor="rateLimitCount">限流次数</label>
          <Input
            defaultValue={String(settings.rateLimitCount)}
            id="rateLimitCount"
            inputMode="numeric"
            min={1}
            name="rateLimitCount"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="rateLimitWindowMs">限流时间窗口（ms）</label>
          <Input
            defaultValue={String(settings.rateLimitWindowMs)}
            id="rateLimitWindowMs"
            inputMode="numeric"
            min={1}
            name="rateLimitWindowMs"
            required
            type="number"
          />
        </div>
      </div>
      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存 API 基础设置
        </Button>
      </div>
    </FormShell>
  );
}

function RectificationSettingsForm({ settings }: { settings: HuiYunYingApiSettings }) {
  return (
    <FormShell tab="rectification">
      <div className={styles.formGrid}>
        <div className="field">
          <label htmlFor="rectificationCreateRoute">整改单新增 Route</label>
          <Input
            defaultValue={settings.rectificationCreateRoute}
            id="rectificationCreateRoute"
            name="rectificationCreateRoute"
            placeholder="/route/ri/open/item/create"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationListRoute">整改单查询 Route</label>
          <Input
            defaultValue={settings.rectificationListRoute}
            id="rectificationListRoute"
            name="rectificationListRoute"
            placeholder="/route/ri/open/item/list"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationDescriptionMaxLength">描述最大长度</label>
          <Input
            defaultValue={String(settings.rectificationDescriptionMaxLength)}
            id="rectificationDescriptionMaxLength"
            inputMode="numeric"
            min={1}
            name="rectificationDescriptionMaxLength"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="defaultShouldCorrectedDays">默认整改天数</label>
          <Input
            defaultValue={String(settings.defaultShouldCorrectedDays)}
            id="defaultShouldCorrectedDays"
            inputMode="numeric"
            min={0}
            name="defaultShouldCorrectedDays"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationSyncIntervalMs">整改单查询间隔（ms）</label>
          <Input
            defaultValue={String(settings.rectificationSyncIntervalMs)}
            id="rectificationSyncIntervalMs"
            inputMode="numeric"
            min={0}
            name="rectificationSyncIntervalMs"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationSyncRetryCount">同步重试次数</label>
          <Input
            defaultValue={String(settings.rectificationSyncRetryCount)}
            id="rectificationSyncRetryCount"
            inputMode="numeric"
            min={0}
            name="rectificationSyncRetryCount"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationSyncTimeoutMs">同步超时（ms）</label>
          <Input
            defaultValue={String(settings.rectificationSyncTimeoutMs)}
            id="rectificationSyncTimeoutMs"
            inputMode="numeric"
            min={1}
            name="rectificationSyncTimeoutMs"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="rectificationSyncBatchSize">单次同步数量</label>
          <Input
            defaultValue={String(settings.rectificationSyncBatchSize)}
            id="rectificationSyncBatchSize"
            inputMode="numeric"
            min={1}
            name="rectificationSyncBatchSize"
            required
            type="number"
          />
        </div>
      </div>
      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存整改单设置
        </Button>
      </div>
    </FormShell>
  );
}

function RectificationSyncDashboardSection() {
  const syncDashboard = rectificationService.getSyncDashboard();
  const latestBatch = syncDashboard.recent_batches[0] || null;

  return (
    <div className={styles.settingSection}>
      <div className={styles.settingSectionHeader}>
        <h4 className={styles.settingSectionTitle}>同步任务概览</h4>
        <p className={styles.settingSectionCopy}>查看整改单状态同步最近一次执行结果，以及近 7 日同步统计。</p>
      </div>

      <div className={styles.healthGrid}>
        <article className={styles.healthCard}>
          <div className={styles.healthHead}>
            <div className={styles.settingSectionHeader}>
              <h5 className={styles.healthTitle}>最近批次</h5>
              <p className={styles.settingSectionCopy}>最近一次定时同步的执行结果与耗时统计。</p>
            </div>
          </div>
          <div className={styles.healthMeta}>
            <span>批次号：{latestBatch?.sync_batch_id || "-"}</span>
            <span>开始时间：{latestBatch?.started_at ? formatDisplayDate(latestBatch.started_at) : "暂无同步记录"}</span>
            <span>
              成功 / 失败：{latestBatch ? `${latestBatch.success_count} / ${latestBatch.failed_count}` : "-"}
            </span>
            <span>
              未命中 / 跳过：
              {latestBatch ? `${latestBatch.not_found_count} / ${latestBatch.skipped_count}` : "-"}
            </span>
            <span>
              平均 / 峰值耗时：
              {latestBatch?.average_response_time_ms ? `${latestBatch.average_response_time_ms} ms` : "-"}
              {latestBatch?.max_response_time_ms ? ` / ${latestBatch.max_response_time_ms} ms` : ""}
            </span>
          </div>
        </article>
      </div>

      <div className={styles.settingSectionHeader}>
        <h5 className={styles.healthTitle}>近 7 日同步统计</h5>
        <p className={styles.settingSectionCopy}>按天汇总同步成功、失败、未命中与接口响应时间。</p>
      </div>
      {syncDashboard.daily_stats.length > 0 ? (
        <div className={styles.syncTableWrap}>
          <table className={styles.syncTable}>
            <thead>
              <tr>
                <th>日期</th>
                <th>批次</th>
                <th>扫描</th>
                <th>成功</th>
                <th>失败</th>
                <th>未命中</th>
                <th>跳过</th>
                <th>平均耗时</th>
              </tr>
            </thead>
            <tbody>
              {syncDashboard.daily_stats.map((item) => (
                <tr key={item.sync_date}>
                  <td>{item.sync_date}</td>
                  <td>{item.batch_count}</td>
                  <td>{item.scanned_count}</td>
                  <td>{item.success_count}</td>
                  <td>{item.failed_count}</td>
                  <td>{item.not_found_count}</td>
                  <td>{item.skipped_count}</td>
                  <td>{item.average_response_time_ms ? `${item.average_response_time_ms} ms` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.healthEmpty}>最近 7 天暂无同步统计。</div>
      )}
    </div>
  );
}

function AnalyticsSettingsForm({
  settings,
  healthItems
}: {
  settings: HuiYunYingApiSettings;
  healthItems: AnalyticsPipelineHealthItem[];
}) {
  return (
    <FormShell tab="analytics">
      <div className={styles.formGrid}>
        <div className="field">
          <label htmlFor="analyticsFactRefreshIntervalMs">分析事实刷新间隔（ms）</label>
          <Input
            defaultValue={String(settings.analyticsFactRefreshIntervalMs)}
            id="analyticsFactRefreshIntervalMs"
            inputMode="numeric"
            min={0}
            name="analyticsFactRefreshIntervalMs"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="analyticsSnapshotRefreshIntervalMs">分析快照刷新间隔（ms）</label>
          <Input
            defaultValue={String(settings.analyticsSnapshotRefreshIntervalMs)}
            id="analyticsSnapshotRefreshIntervalMs"
            inputMode="numeric"
            min={0}
            name="analyticsSnapshotRefreshIntervalMs"
            required
            type="number"
          />
        </div>
      </div>
      <div className={styles.settingSection}>
        <div className={styles.settingSectionHeader}>
          <h4 className={styles.settingSectionTitle}>任务执行情况</h4>
          <p className={styles.settingSectionCopy}>查看分析事实刷新和日快照刷新最近一次执行状态与时间。</p>
        </div>
        <div className={styles.healthGrid}>
          {healthItems.map((item) => (
            <article className={styles.healthCard} key={item.job_type}>
              <div className={styles.healthHead}>
                <div className={styles.settingSectionHeader}>
                  <h5 className={styles.healthTitle}>{analyticsJobLabel(item.job_type)}</h5>
                  <p className={styles.settingSectionCopy}>{analyticsJobDescription(item.job_type)}</p>
                </div>
                <Badge variant={healthTone(item.status)}>{item.status}</Badge>
              </div>
              <div className={styles.healthMeta}>
                <span>调度间隔：{item.interval_ms} ms</span>
                <span>最近完成：{formatDateTime(item.last_finished_at)}</span>
                <span>状态说明：{item.message}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存分析任务设置
        </Button>
      </div>
    </FormShell>
  );
}

function SettingsWorkspace({
  activeTab,
  settings,
  analyticsHealthItems
}: {
  activeTab: SettingsTab;
  settings: HuiYunYingApiSettings;
  analyticsHealthItems: AnalyticsPipelineHealthItem[];
}) {
  const active = tabs.find((item) => item.key === activeTab) || tabs[0];

  return (
    <Card className={styles.workspaceCard}>
      <CardHeader className={styles.workspaceHeader}>
        <div>
          <CardTitle className={styles.workspaceTitle}>系统设置</CardTitle>
          <CardDescription className={styles.workspaceCopy}>
            左侧切换系统设置分类。当前分类独立提交并即时生效，不影响其他配置分组。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.workspaceBody}>
        <Tabs className={styles.workspaceTabs}>
          <TabsList className={styles.verticalTabs} orientation="vertical">
            {tabs.map((tab) => (
              <TabsTrigger asChild isActive={tab.key === activeTab} key={tab.key} orientation="vertical">
                <Link aria-current={tab.key === activeTab ? "page" : undefined} href={`/admin/settings?tab=${tab.key}`}>
                  {tab.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent className={styles.tabPanel}>
            <div className={styles.settingSectionHeader}>
              <h3 className={styles.settingSectionTitle}>{active.label}</h3>
              <p className={styles.settingSectionCopy}>{active.description}</p>
            </div>
            {activeTab === "api" ? <ApiSettingsForm settings={settings} /> : null}
            {activeTab === "rectification" ? (
              <>
                <RectificationSettingsForm settings={settings} />
                <RectificationSyncDashboardSection />
              </>
            ) : null}
            {activeTab === "analytics" ? <AnalyticsSettingsForm healthItems={analyticsHealthItems} settings={settings} /> : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("user:manage", "/admin/settings");
  if (!currentUser.roles.includes("admin")) {
    redirect("/reports");
  }

  const settings = systemSettingsService.getHuiYunYingApiSettings();
  const resolvedSearchParams = await searchParams;
  const activeTab = resolveTab(resolvedSearchParams.tab);
  const analyticsHealthItems = analyticsJobService.getHealthSummary({
    result_fact_rebuild: settings.analyticsFactRefreshIntervalMs,
    daily_snapshot_rebuild: settings.analyticsSnapshotRefreshIntervalMs
  });

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="系统管理工作台"
        title="系统管理 / 系统设置"
      />

      <section className="section">
        <SystemManagementTabs activeTab="settings" />
      </section>

      <section className="section">
        <SettingsWorkspace activeTab={activeTab} analyticsHealthItems={analyticsHealthItems} settings={settings} />
      </section>
    </main>
  );
}
