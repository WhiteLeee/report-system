import { redirect } from "next/navigation";

import styles from "./jobs-page.module.css";

import { createAnalyticsJobRepository, createAnalyticsJobService } from "@/backend/analytics/analytics.module";
import { requirePermission } from "@/backend/auth/session";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardHeader } from "@/ui/dashboard-header";
import { formatDisplayDate } from "@/ui/report-view";

export const dynamic = "force-dynamic";

const analyticsJobRepository = createAnalyticsJobRepository();
const analyticsJobService = createAnalyticsJobService();
const systemSettingsService = createSystemSettingsService();

function statusTone(status: string): "default" | "secondary" | "outline" {
  if (status === "completed") {
    return "secondary";
  }
  if (status === "failed") {
    return "outline";
  }
  return "default";
}

function pipelineTone(status: string): "default" | "secondary" | "outline" {
  if (status === "healthy") {
    return "secondary";
  }
  if (status === "failed") {
    return "default";
  }
  return "outline";
}

export default async function AnalyticsJobsPage() {
  const currentUser = await requirePermission("user:manage", "/analytics/jobs");
  if (!currentUser.roles.includes("admin")) {
    redirect("/analytics");
  }

  const runs = analyticsJobRepository.listRuns(30);
  const checkpoints = analyticsJobRepository.listCheckpoints();
  const settings = systemSettingsService.getHuiYunYingApiSettings();
  const healthItems = analyticsJobService.getHealthSummary({
    result_fact_rebuild: settings.analyticsFactRefreshIntervalMs,
    daily_snapshot_rebuild: settings.analyticsSnapshotRefreshIntervalMs
  });

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="查看分析任务执行记录，并手动触发 facts / snapshots 重建。"
        title="分析任务"
      />

      <section className={`section ${styles.hero}`}>
        <Card>
          <CardHeader>
            <CardTitle>手动重建</CardTitle>
            <CardDescription>用于口径升级、数据回补或调试时手动执行分析任务。</CardDescription>
          </CardHeader>
          <CardContent className={styles.actionCardBody}>
            <div className={styles.actionGrid}>
              <div className={styles.actionRow}>
                <div className={styles.actionMeta}>
                  <strong className={styles.actionTitle}>重建分析事实</strong>
                  <span className={styles.actionCopy}>重建 result / issue / review / rectification facts。</span>
                </div>
                <form action="/api/analytics/jobs/run" method="post">
                  <input name="jobType" type="hidden" value="result_fact_rebuild" />
                  <Button size="sm" type="submit">执行重建</Button>
                </form>
              </div>
              <div className={styles.actionRow}>
                <div className={styles.actionMeta}>
                  <strong className={styles.actionTitle}>重建日快照</strong>
                  <span className={styles.actionCopy}>重建 daily overview / semantic snapshots。</span>
                </div>
                <form action="/api/analytics/jobs/run" method="post">
                  <input name="jobType" type="hidden" value="daily_snapshot_rebuild" />
                  <Button size="sm" type="submit">执行重建</Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前调度设置</CardTitle>
            <CardDescription>定时任务来自系统管理 &gt; 分析任务设置，可随时调整为关闭或指定间隔。</CardDescription>
          </CardHeader>
          <CardContent className={styles.settingList}>
            <div className={styles.settingItem}>
              <span className={styles.settingLabel}>分析事实刷新</span>
              <strong className={styles.settingValue}>{settings.analyticsFactRefreshIntervalMs}</strong>
              <span className={styles.actionCopy}>毫秒，0 表示关闭</span>
            </div>
            <div className={styles.settingItem}>
              <span className={styles.settingLabel}>分析快照刷新</span>
              <strong className={styles.settingValue}>{settings.analyticsSnapshotRefreshIntervalMs}</strong>
              <span className={styles.actionCopy}>毫秒，0 表示关闭</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={`section ${styles.sectionGrid}`}>
        <Card>
          <CardHeader>
            <CardTitle>分析链路健康度</CardTitle>
            <CardDescription>根据最近一次 job、checkpoint 和配置间隔判断当前 facts / snapshots 是否健康。</CardDescription>
          </CardHeader>
          <CardContent className={styles.checkpointGrid}>
            {healthItems.map((item) => (
              <article className={styles.checkpointCard} key={item.job_type}>
                <div className={styles.checkpointHead}>
                  <div className={styles.primaryCell}>
                    <strong>{item.job_type}</strong>
                    <span className={styles.cellMeta}>间隔: {item.interval_ms} ms</span>
                  </div>
                  <Badge variant={pipelineTone(item.status)}>{item.status}</Badge>
                </div>
                <div className={styles.primaryCell}>
                  <span className={styles.cellMeta}>最近完成: {item.last_finished_at ? formatDisplayDate(item.last_finished_at) : "-"}</span>
                  <span className={styles.cellMeta}>说明: {item.message}</span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>任务检查点</CardTitle>
            <CardDescription>记录每类任务最近一次执行结果，便于确认当前 facts / snapshots 是否健康。</CardDescription>
          </CardHeader>
          <CardContent>
            {checkpoints.length > 0 ? (
              <div className={styles.checkpointGrid}>
                {checkpoints.map((checkpoint) => {
                  const lastStatus = String(checkpoint.checkpoint.last_status || "-");
                  const metrics =
                    checkpoint.checkpoint.metrics && typeof checkpoint.checkpoint.metrics === "object"
                      ? (checkpoint.checkpoint.metrics as Record<string, unknown>)
                      : {};
                  return (
                    <article className={styles.checkpointCard} key={`${checkpoint.job_type}-${checkpoint.scope_key}`}>
                      <div className={styles.checkpointHead}>
                        <div className={styles.primaryCell}>
                          <strong>{checkpoint.job_type}</strong>
                          <span className={styles.cellMeta}>scope: {checkpoint.scope_key}</span>
                        </div>
                        <Badge variant={statusTone(lastStatus)}>{lastStatus}</Badge>
                      </div>
                      <div className={styles.primaryCell}>
                        <span className={styles.cellMeta}>
                          最近完成: {formatDisplayDate(String(checkpoint.checkpoint.finished_at || checkpoint.updated_at))}
                        </span>
                        <span className={styles.cellMeta}>
                          job_key: {String(checkpoint.checkpoint.last_job_key || "-")}
                        </span>
                        <span className={styles.cellMeta}>
                          错误: {String(checkpoint.checkpoint.error_message || "-")}
                        </span>
                      </div>
                      <div className={styles.primaryCell}>
                        {Object.keys(metrics).length > 0 ? (
                          Object.entries(metrics).map(([key, value]) => (
                            <span className={styles.cellMeta} key={`${checkpoint.job_type}-${key}`}>
                              {key}: {String(value)}
                            </span>
                          ))
                        ) : (
                          <span className={styles.cellMeta}>暂无指标</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState>当前还没有 analytics job checkpoint。</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近任务记录</CardTitle>
            <CardDescription>展示最近 30 条 analytics job 运行记录。</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>任务</th>
                      <th>状态</th>
                      <th>指标</th>
                      <th>开始时间</th>
                      <th>结束时间</th>
                      <th>错误</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.job_key}>
                        <td>
                          <div className={styles.primaryCell}>
                            <strong>{run.job_type}</strong>
                            <span className={styles.cellMeta}>{run.job_key}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant={statusTone(run.status)}>{run.status}</Badge>
                        </td>
                        <td>
                          <div className={styles.primaryCell}>
                            {Object.keys(run.metrics).length > 0 ? (
                              Object.entries(run.metrics).map(([key, value]) => (
                                <span className={styles.cellMeta} key={`${run.job_key}-${key}`}>
                                  {key}: {String(value)}
                                </span>
                              ))
                            ) : (
                              <span className={styles.cellMeta}>-</span>
                            )}
                          </div>
                        </td>
                        <td>{formatDisplayDate(run.started_at)}</td>
                        <td>{run.finished_at ? formatDisplayDate(run.finished_at) : "-"}</td>
                        <td>
                          <span className={styles.cellMeta}>{run.error_message || "-"}</span>
                        </td>
                        <td>
                          {run.status === "failed" ? (
                            <form action="/api/analytics/jobs/run" method="post">
                              <input name="retryJobKey" type="hidden" value={run.job_key} />
                              <Button size="sm" type="submit" variant="ghost">重跑</Button>
                            </form>
                          ) : (
                            <span className={styles.cellMeta}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>当前还没有 analytics job 运行记录。</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
