import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "./system-settings-page.module.css";
import { ColorSettingField } from "./color-setting-field";

import { requirePermission } from "@/backend/auth/session";
import { createAuthService } from "@/backend/auth/auth.module";
import { createAnalyticsJobService } from "@/backend/analytics/analytics.module";
import type { AnalyticsPipelineHealthItem } from "@/backend/analytics/jobs/analytics-job.types";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { ManagedNavigationMenuItem, RoleCode } from "@/backend/auth/auth.types";
import type {
  AuthSecurityPolicy,
  DeliveryMode,
  EnterpriseBrandingSettings,
  HuiYunYingApiSettings
} from "@/backend/system-settings/system-settings.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { formatDisplayDate } from "@/ui/report/report-view";
import { SystemManagementTabs } from "@/ui/shared/system-management-tabs";

export const dynamic = "force-dynamic";

const systemSettingsService = createSystemSettingsService();
const authService = createAuthService();
const analyticsJobService = createAnalyticsJobService();
const rectificationService = createRectificationService();

const tabs = [
  { key: "branding", label: "企业品牌配置", description: "维护项目级企业名称、Logo、favicon 与主配色。" },
  { key: "api", label: "API 基础设置", description: "维护慧运营 API 访问地址、Route、鉴权和限流参数。" },
  { key: "rectification", label: "整改单设置", description: "维护整改单创建、同步与约束参数。" },
  { key: "analytics", label: "分析任务设置", description: "维护分析事实刷新与日快照刷新的定时任务间隔。" },
  { key: "navigation", label: "菜单与导航", description: "维护导航菜单显示顺序、可见性和角色授权。" },
  { key: "security", label: "安全与交付", description: "维护交付模式，控制 customer 环境对平台账号的可见性。" }
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
  tab,
  multipart = false
}: {
  children: ReactNode;
  tab: SettingsTab;
  multipart?: boolean;
}) {
  return (
    <form
      action="/admin/settings/save"
      className={styles.settingsForm}
      encType={multipart ? "multipart/form-data" : undefined}
      method="post"
    >
      <input name="tab" type="hidden" value={tab} />
      {children}
    </form>
  );
}

function BrandingSettingsForm({ settings }: { settings: EnterpriseBrandingSettings }) {
  return (
    <FormShell multipart tab="branding">
      <div className={styles.formGrid}>
        <div className="field">
          <label htmlFor="enterpriseName">企业名称</label>
          <Input defaultValue={settings.enterpriseName} id="enterpriseName" name="enterpriseName" required />
        </div>
        <ColorSettingField
          defaultValue={settings.primaryColor}
          id="primaryColor"
          label="主色（Hex）"
          name="primaryColor"
          placeholder="#8b5a2b"
        />
        <ColorSettingField
          defaultValue={settings.primaryColorStrong}
          id="primaryColorStrong"
          label="深色（Hex）"
          name="primaryColorStrong"
          placeholder="#6b421d"
        />
        <div className="field">
          <label htmlFor="logoFile">Logo 上传</label>
          <Input accept=".png,.jpg,.jpeg,.webp" id="logoFile" name="logoFile" type="file" />
        </div>
        <div className="field">
          <label htmlFor="faviconFile">Favicon 上传</label>
          <Input accept=".ico,.png" id="faviconFile" name="faviconFile" type="file" />
        </div>
      </div>

      <div className={styles.healthGrid}>
        <article className={styles.healthCard}>
          <h5 className={styles.healthTitle}>当前 Logo</h5>
          {settings.logoUrl ? (
            <img alt="当前 Logo" className={styles.brandingImagePreview} src={settings.logoUrl} />
          ) : (
            <p className={styles.settingSectionCopy}>未配置 Logo。</p>
          )}
        </article>
        <article className={styles.healthCard}>
          <h5 className={styles.healthTitle}>当前 Favicon</h5>
          {settings.faviconUrl ? (
            <img alt="当前 Favicon" className={styles.brandingIconPreview} src={settings.faviconUrl} />
          ) : (
            <p className={styles.settingSectionCopy}>未配置 favicon。</p>
          )}
        </article>
        <article className={styles.healthCard}>
          <h5 className={styles.healthTitle}>主配色预览</h5>
          <div className={styles.brandingColorPreviewRow}>
            <span className={styles.brandingColorLabel}>主色 {settings.primaryColor}</span>
            <span
              className={styles.brandingColorSwatch}
              style={{ backgroundColor: settings.primaryColor }}
            />
          </div>
          <div className={styles.brandingColorPreviewRow}>
            <span className={styles.brandingColorLabel}>深色 {settings.primaryColorStrong}</span>
            <span
              className={styles.brandingColorSwatch}
              style={{ backgroundColor: settings.primaryColorStrong }}
            />
          </div>
        </article>
      </div>

      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存企业品牌配置
        </Button>
      </div>
    </FormShell>
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
          <Table className={styles.syncTable}>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>批次</TableHead>
                <TableHead>扫描</TableHead>
                <TableHead>成功</TableHead>
                <TableHead>失败</TableHead>
                <TableHead>未命中</TableHead>
                <TableHead>跳过</TableHead>
                <TableHead>平均耗时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncDashboard.daily_stats.map((item) => (
                <TableRow key={item.sync_date}>
                  <TableCell>{item.sync_date}</TableCell>
                  <TableCell>{item.batch_count}</TableCell>
                  <TableCell>{item.scanned_count}</TableCell>
                  <TableCell>{item.success_count}</TableCell>
                  <TableCell>{item.failed_count}</TableCell>
                  <TableCell>{item.not_found_count}</TableCell>
                  <TableCell>{item.skipped_count}</TableCell>
                  <TableCell>{item.average_response_time_ms ? `${item.average_response_time_ms} ms` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

function SecuritySettingsForm({
  deliveryMode,
  securityPolicy
}: {
  deliveryMode: DeliveryMode;
  securityPolicy: AuthSecurityPolicy;
}) {
  return (
    <FormShell tab="security">
      <div className={styles.formGrid}>
        <div className="field">
          <label htmlFor="deliveryMode">交付模式</label>
          <NativeSelect defaultValue={deliveryMode} id="deliveryMode" name="deliveryMode">
            <option value="internal">internal（实施/内部全量可见）</option>
            <option value="customer">customer（隐藏平台 admin 账号）</option>
          </NativeSelect>
        </div>
        <div className="field">
          <label htmlFor="passwordMinLength">密码最小长度</label>
          <Input
            defaultValue={String(securityPolicy.passwordMinLength)}
            id="passwordMinLength"
            inputMode="numeric"
            min={8}
            name="passwordMinLength"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="loginMaxFailures">最大失败次数</label>
          <Input
            defaultValue={String(securityPolicy.loginMaxFailures)}
            id="loginMaxFailures"
            inputMode="numeric"
            min={1}
            name="loginMaxFailures"
            required
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="loginLockDurationMs">锁定时长（ms）</label>
          <Input
            defaultValue={String(securityPolicy.loginLockDurationMs)}
            id="loginLockDurationMs"
            inputMode="numeric"
            min={1000}
            name="loginLockDurationMs"
            required
            type="number"
          />
        </div>
      </div>
      <div className={styles.permissionChecklist}>
        <label className={styles.permissionOption}>
          <Checkbox className={styles.permissionCheckbox} defaultChecked={securityPolicy.requireUppercase} name="requireUppercase" value="1" />
          <span className={styles.permissionOptionBody}>
            <strong>密码要求大写字母</strong>
            <span>启用后密码需包含至少 1 个 A-Z。</span>
          </span>
        </label>
        <label className={styles.permissionOption}>
          <Checkbox className={styles.permissionCheckbox} defaultChecked={securityPolicy.requireLowercase} name="requireLowercase" value="1" />
          <span className={styles.permissionOptionBody}>
            <strong>密码要求小写字母</strong>
            <span>启用后密码需包含至少 1 个 a-z。</span>
          </span>
        </label>
        <label className={styles.permissionOption}>
          <Checkbox className={styles.permissionCheckbox} defaultChecked={securityPolicy.requireNumber} name="requireNumber" value="1" />
          <span className={styles.permissionOptionBody}>
            <strong>密码要求数字</strong>
            <span>启用后密码需包含至少 1 个 0-9。</span>
          </span>
        </label>
        <label className={styles.permissionOption}>
          <Checkbox
            className={styles.permissionCheckbox}
            defaultChecked={securityPolicy.requireSpecialCharacter}
            name="requireSpecialCharacter"
            value="1"
          />
          <span className={styles.permissionOptionBody}>
            <strong>密码要求特殊字符</strong>
            <span>启用后密码需包含至少 1 个符号（非字母数字）。</span>
          </span>
        </label>
      </div>
      <p className={styles.settingSectionCopy}>
        customer 模式下，平台 bootstrap admin 账号将不在用户管理页面展示，且禁止通过 API 编辑该账号。
      </p>
      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存安全与交付设置
        </Button>
      </div>
    </FormShell>
  );
}

function NavigationSettingsForm({ menuItems }: { menuItems: ManagedNavigationMenuItem[] }) {
  const mutableRoles: RoleCode[] = ["manage", "reviewer", "viewer"];
  const roleLabels: Record<RoleCode, string> = {
    admin: "admin",
    manage: "manage",
    reviewer: "reviewer",
    viewer: "viewer"
  };

  return (
    <FormShell tab="navigation">
      <div className={styles.settingSection}>
        <div className={styles.settingSectionHeader}>
          <h4 className={styles.settingSectionTitle}>菜单授权矩阵</h4>
          <p className={styles.settingSectionCopy}>admin 菜单授权固定为全开；manage/reviewer/viewer 可按菜单配置显示权限。</p>
        </div>
        <div className={styles.syncTableWrap}>
          <Table className={styles.syncTable}>
            <TableHeader>
              <TableRow>
                <TableHead>菜单</TableHead>
                <TableHead>路由</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>显示</TableHead>
                <TableHead>admin</TableHead>
                <TableHead>manage</TableHead>
                <TableHead>reviewer</TableHead>
                <TableHead>viewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuItems.map((item) => (
                <TableRow key={item.code}>
                  <TableCell>
                    <div className={styles.menuCodeCell}>
                      <strong>{item.label}</strong>
                      <span>{item.code}</span>
                    </div>
                    <input name={`menuCode:${item.code}`} type="hidden" value={item.code} />
                    <input name={`menuLabel:${item.code}`} type="hidden" value={item.label} />
                    <input name={`menuHref:${item.code}`} type="hidden" value={item.href} />
                    <input name={`menuIcon:${item.code}`} type="hidden" value={item.icon} />
                  </TableCell>
                  <TableCell>{item.href}</TableCell>
                  <TableCell>
                    <Input defaultValue={String(item.sortOrder)} inputMode="numeric" min={0} name={`menuSortOrder:${item.code}`} type="number" />
                  </TableCell>
                  <TableCell>
                    <Checkbox className={styles.tableCheckbox} defaultChecked={item.visible} name={`menuVisible:${item.code}`} value="1" />
                  </TableCell>
                  <TableCell>
                    <Checkbox className={styles.tableCheckbox} defaultChecked disabled />
                  </TableCell>
                  {mutableRoles.map((roleCode) => {
                    const adminOnlyMenu = item.code === "system";
                    const checked = item.roleCodes.includes(roleCode);
                    return (
                      <TableCell key={`${item.code}:${roleCode}`}>
                        <Checkbox
                          defaultChecked={checked}
                          disabled={adminOnlyMenu}
                          name={`menuRole:${roleCode}:${item.code}`}
                          className={styles.tableCheckbox}
                          value="1"
                        />
                        {adminOnlyMenu ? <span className={styles.menuRoleHint}>仅 admin</span> : null}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className={styles.settingSectionCopy}>
          角色说明：{mutableRoles.map((roleCode) => roleLabels[roleCode]).join(" / ")}。
        </p>
      </div>
      <div className={styles.formActions}>
        <Button size="sm" type="submit">
          保存菜单与导航设置
        </Button>
      </div>
    </FormShell>
  );
}

function SettingsWorkspace({
  activeTab,
  settings,
  brandingSettings,
  analyticsHealthItems,
  deliveryMode,
  securityPolicy,
  navigationMenus,
  errorMessage
}: {
  activeTab: SettingsTab;
  settings: HuiYunYingApiSettings;
  brandingSettings: EnterpriseBrandingSettings;
  analyticsHealthItems: AnalyticsPipelineHealthItem[];
  deliveryMode: DeliveryMode;
  securityPolicy: AuthSecurityPolicy;
  navigationMenus: ManagedNavigationMenuItem[];
  errorMessage: string;
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
            {errorMessage ? (
              <div className={styles.saveErrorBanner}>
                <strong>保存失败：</strong>
                {errorMessage}
              </div>
            ) : null}
            <div className={styles.settingSectionHeader}>
              <h3 className={styles.settingSectionTitle}>{active.label}</h3>
              <p className={styles.settingSectionCopy}>{active.description}</p>
            </div>
            {activeTab === "branding" ? <BrandingSettingsForm settings={brandingSettings} /> : null}
            {activeTab === "api" ? <ApiSettingsForm settings={settings} /> : null}
            {activeTab === "rectification" ? (
              <>
                <RectificationSettingsForm settings={settings} />
                <RectificationSyncDashboardSection />
              </>
            ) : null}
            {activeTab === "analytics" ? <AnalyticsSettingsForm healthItems={analyticsHealthItems} settings={settings} /> : null}
            {activeTab === "navigation" ? <NavigationSettingsForm menuItems={navigationMenus} /> : null}
            {activeTab === "security" ? (
              <SecuritySettingsForm deliveryMode={deliveryMode} securityPolicy={securityPolicy} />
            ) : null}
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
  const currentUser = await requirePermission("system:settings:read", "/admin/settings");
  if (!currentUser.roles.includes("admin")) {
    redirect("/reports");
  }

  const settings = systemSettingsService.getHuiYunYingApiSettings();
  const brandingSettings = systemSettingsService.getEnterpriseBrandingSettings();
  const resolvedSearchParams = await searchParams;
  const activeTab = resolveTab(resolvedSearchParams.tab);
  const errorMessage =
    typeof resolvedSearchParams.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : "";
  const deliveryMode = systemSettingsService.getDeliveryMode();
  const securityPolicy = systemSettingsService.getAuthSecurityPolicy();
  const navigationMenus = authService.listManagedNavigationMenus();
  const analyticsHealthItems = analyticsJobService.getHealthSummary({
    result_fact_rebuild: settings.analyticsFactRefreshIntervalMs,
    daily_snapshot_rebuild: settings.analyticsSnapshotRefreshIntervalMs
  });

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/admin/settings"
        currentUser={currentUser}
        subtitle="系统管理工作台"
        title="系统管理 / 系统设置"
      />

      <section className="section">
        <SystemManagementTabs activeTab="settings" />
      </section>

      <section className="section">
        <SettingsWorkspace
          activeTab={activeTab}
          analyticsHealthItems={analyticsHealthItems}
          brandingSettings={brandingSettings}
          deliveryMode={deliveryMode}
          errorMessage={errorMessage}
          navigationMenus={navigationMenus}
          securityPolicy={securityPolicy}
          settings={settings}
        />
      </section>
    </main>
  );
}
