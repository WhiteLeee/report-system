import { redirect } from "next/navigation";

import styles from "./system-settings-page.module.css";

import { requirePermission } from "@/backend/auth/session";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardHeader } from "@/ui/dashboard-header";

export const dynamic = "force-dynamic";

const systemSettingsService = createSystemSettingsService();

export default async function AdminSettingsPage() {
  const currentUser = await requirePermission("user:manage", "/admin/settings");
  if (!currentUser.roles.includes("admin")) {
    redirect("/reports");
  }

  const huiYunYingApiSettings = systemSettingsService.getHuiYunYingApiSettings();

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="集中维护系统级参数。当前仅开放慧运营 API 与限流参数，后续可继续扩展其他系统设置。"
        title="系统设置"
      />

      <section className="section">
        <Card className={styles.workspaceCard}>
          <CardHeader className={styles.workspaceHeader}>
            <div>
              <CardTitle className={styles.workspaceTitle}>慧运营 API 设置</CardTitle>
              <CardDescription className={styles.workspaceCopy}>
                配置接口访问地址、鉴权参数和请求限流。当前页面仅允许管理员操作。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={styles.workspaceBody}>
            <form action="/admin/settings/save" className={styles.settingsForm} method="post">
              <div className={styles.formGrid}>
                <div className="field">
                  <label htmlFor="uri">URI</label>
                  <Input defaultValue={huiYunYingApiSettings.uri} id="uri" name="uri" placeholder="https://api.example.com" required />
                </div>
                <div className="field">
                  <label htmlFor="route">Route</label>
                  <Input
                    defaultValue={huiYunYingApiSettings.route}
                    id="route"
                    name="route"
                    placeholder="/openapi/v1/report"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="rectificationCreateRoute">整改单新增 Route</label>
                  <Input
                    defaultValue={huiYunYingApiSettings.rectificationCreateRoute}
                    id="rectificationCreateRoute"
                    name="rectificationCreateRoute"
                    placeholder="/route/ri/open/item/create"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="rectificationListRoute">整改单查询 Route</label>
                  <Input
                    defaultValue={huiYunYingApiSettings.rectificationListRoute}
                    id="rectificationListRoute"
                    name="rectificationListRoute"
                    placeholder="/route/ri/open/item/list"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="appid">App ID</label>
                  <Input defaultValue={huiYunYingApiSettings.appid} id="appid" name="appid" placeholder="请输入 appid" required />
                </div>
                <div className="field">
                  <label htmlFor="secret">Secret</label>
                  <Input
                    defaultValue={huiYunYingApiSettings.secret}
                    id="secret"
                    name="secret"
                    placeholder="请输入 secret"
                    required
                    type="password"
                  />
                </div>
              </div>

              <div className={styles.settingSection}>
                <div className={styles.settingSectionHeader}>
                  <h3 className={styles.settingSectionTitle}>API 限流设置</h3>
                  <p className={styles.settingSectionCopy}>按请求次数和时间窗口控制调用频率，默认 30 次 / 60000 ms。</p>
                </div>
                <div className={styles.rateLimitRow}>
                  <div className="field">
                    <label htmlFor="rateLimitCount">次数</label>
                    <Input
                      defaultValue={String(huiYunYingApiSettings.rateLimitCount)}
                      id="rateLimitCount"
                      inputMode="numeric"
                      min={1}
                      name="rateLimitCount"
                      required
                      type="number"
                    />
                  </div>
                  <div className={styles.rateLimitSlash}>/</div>
                  <div className="field">
                    <label htmlFor="rateLimitWindowMs">时间窗口（ms）</label>
                    <Input
                      defaultValue={String(huiYunYingApiSettings.rateLimitWindowMs)}
                      id="rateLimitWindowMs"
                      inputMode="numeric"
                      min={1}
                      name="rateLimitWindowMs"
                      required
                      type="number"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.settingSection}>
                <div className={styles.settingSectionHeader}>
                  <h3 className={styles.settingSectionTitle}>整改单同步设置</h3>
                  <p className={styles.settingSectionCopy}>用于约束描述长度，并配置定时同步的间隔、超时、重试次数与批处理规模。</p>
                </div>
                <div className={styles.formGrid}>
                  <div className="field">
                    <label htmlFor="rectificationDescriptionMaxLength">描述最大长度</label>
                    <Input
                      defaultValue={String(huiYunYingApiSettings.rectificationDescriptionMaxLength)}
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
                      defaultValue={String(huiYunYingApiSettings.defaultShouldCorrectedDays)}
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
                      defaultValue={String(huiYunYingApiSettings.rectificationSyncIntervalMs)}
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
                      defaultValue={String(huiYunYingApiSettings.rectificationSyncRetryCount)}
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
                      defaultValue={String(huiYunYingApiSettings.rectificationSyncTimeoutMs)}
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
                      defaultValue={String(huiYunYingApiSettings.rectificationSyncBatchSize)}
                      id="rectificationSyncBatchSize"
                      inputMode="numeric"
                      min={1}
                      name="rectificationSyncBatchSize"
                      required
                      type="number"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <Button size="sm" type="submit">
                  保存设置
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
