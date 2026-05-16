import { randomUUID } from "node:crypto";

import type { AnalyticsFactService } from "@/backend/analytics/facts/analytics-fact.service";
import type { AnalyticsJobRepository } from "@/backend/analytics/jobs/analytics-job.repository";
import type {
  AnalyticsJobType,
  AnalyticsPipelineHealthItem,
  AnalyticsPipelineHealthStatus
} from "@/backend/analytics/jobs/analytics-job.types";
import type { AnalyticsSnapshotService } from "@/backend/analytics/snapshots/analytics-snapshot.service";

function buildCheckpoint(
  jobType: AnalyticsJobType,
  jobKey: string,
  status: "completed" | "failed",
  scope: Record<string, unknown>,
  metrics: Record<string, unknown>,
  errorMessage: string
): any {
  return {
    job_type: jobType,
    last_job_key: jobKey,
    last_status: status,
    scope,
    metrics,
    error_message: errorMessage,
    finished_at: new Date().toISOString()
  };
}

export class AnalyticsJobService {
  constructor(
    private readonly repository: AnalyticsJobRepository,
    private readonly factService: AnalyticsFactService,
    private readonly snapshotService: AnalyticsSnapshotService
  ) {}

  async runResultFactRebuild(): Promise<any> {
    return this.executeJob("result_fact_rebuild", {}, async () => await this.factService.rebuildAllFacts());
  }

  async runDailySnapshotRebuild(): Promise<any> {
    return this.executeJob("daily_snapshot_rebuild", {}, async () => await this.snapshotService.rebuildDailySnapshots());
  }

  async retryJob(jobKey: string): Promise<any> {
    const run = await this.repository.getRunByKey(jobKey);
    if (!run) {
      throw new Error("Analytics job not found.");
    }
    if (run.status === "running") {
      throw new Error("Running job cannot be retried.");
    }
    if (run.job_type === "result_fact_rebuild") {
      return this.runResultFactRebuild();
    }
    if (run.job_type === "daily_snapshot_rebuild") {
      return this.runDailySnapshotRebuild();
    }
    throw new Error("Unsupported analytics job type.");
  }

  async getHealthSummary(intervals: {
    result_fact_rebuild: number;
    daily_snapshot_rebuild: number;
  }): Promise<any> {
    const rows: AnalyticsPipelineHealthItem[] = [];
    for (const jobType of ["result_fact_rebuild", "daily_snapshot_rebuild"] as const) {
      const intervalMs = Math.max(0, intervals[jobType]);
      const checkpoint = await this.repository.getCheckpoint(jobType, "global");
      const latestRun = await this.repository.getLatestRunByType(jobType);
      const lastFinishedAt = String(
        checkpoint?.checkpoint.finished_at || latestRun?.finished_at || latestRun?.started_at || ""
      ).trim();

      let status: AnalyticsPipelineHealthStatus = "idle";
      let message = "还没有运行记录。";

      if (intervalMs === 0) {
        status = "disabled";
        message = "当前已关闭自动调度。";
      } else if (checkpoint?.checkpoint.last_status === "failed" || latestRun?.status === "failed") {
        status = "failed";
        message = String(checkpoint?.checkpoint.error_message || latestRun?.error_message || "最近一次执行失败。");
      } else if (lastFinishedAt) {
        const ageMs = Date.now() - Date.parse(lastFinishedAt);
        const staleAfterMs = intervalMs * 2;
        if (Number.isFinite(ageMs) && ageMs > staleAfterMs) {
          status = "stale";
          message = `最近一次完成已超过 ${Math.floor(staleAfterMs / 1000)} 秒，建议检查调度。`;
        } else {
          status = "healthy";
          message = "最近一次执行正常。";
        }
      }

      rows.push({
        job_type: jobType,
        status,
        interval_ms: intervalMs,
        latest_run: latestRun,
        checkpoint,
        last_finished_at: lastFinishedAt || null,
        stale_after_ms: intervalMs > 0 ? intervalMs * 2 : null,
        message
      });
    }
    return rows;
  }

  private async executeJob<T extends Record<string, unknown>>(
    jobType: AnalyticsJobType,
    scope: Record<string, unknown>,
    handler: () => Promise<T>
  ): Promise<any> {
    const startedAt = new Date().toISOString();
    const jobKey = `analytics-${jobType}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await this.repository.createRun({
      jobKey,
      jobType,
      status: "running",
      scopeJson: JSON.stringify(scope),
      metricsJson: "{}",
      errorMessage: "",
      startedAt,
      updatedAt: startedAt
    });

    try {
      const metrics = await handler();
      await this.repository.upsertCheckpoint(jobType, "global", buildCheckpoint(jobType, jobKey, "completed", scope, metrics, ""));
      await this.repository.finishRun(jobKey, {
        status: "completed",
        metricsJson: JSON.stringify(metrics),
        errorMessage: "",
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { job_key: jobKey, ...metrics };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.repository.upsertCheckpoint(
        jobType,
        "global",
        buildCheckpoint(jobType, jobKey, "failed", scope, {}, message)
      );
      await this.repository.finishRun(jobKey, {
        status: "failed",
        metricsJson: "{}",
        errorMessage: message,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }
}
