import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { resolveTestAdminDbUrl, resolveTestDbUrl, shouldManageIsolatedDatabase } from "./postgres-test-env";

const tempRoot = mkdtempSync(join(tmpdir(), "report-analytics-jobs-"));
const dataDir = join(tempRoot, "data");
const isolatedDbName = `report_test_analytics_jobs_${randomUUID().replace(/-/g, "_")}`;
const dbUrl = resolveTestDbUrl(isolatedDbName);
const adminDbUrl = resolveTestAdminDbUrl();
mkdirSync(dataDir, { recursive: true });

process.env.REPORT_SYSTEM_DATA_DIR = dataDir;
process.env.REPORT_SYSTEM_DB_URL = dbUrl;
process.env.REPORT_SYSTEM_TENANT_ID = "demo";
process.env.REPORT_SYSTEM_TENANT_NAME = "示例客户";
process.env.REPORT_SYSTEM_BRAND_NAME = "示例报告系统";
process.env.REPORT_SYSTEM_BASE_URL = "http://127.0.0.1:3000";
process.env.REPORT_SYSTEM_ADMIN_USERNAME = "admin";
process.env.REPORT_SYSTEM_ADMIN_PASSWORD = "ChangeMe123!";
process.env.REPORT_SYSTEM_ADMIN_DISPLAY_NAME = "系统管理员";
process.env.REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS = "2";

let analyticsModule: typeof import("../backend/analytics/analytics.module");

async function createIsolatedDatabase(): Promise<void> {
  if (!shouldManageIsolatedDatabase()) {
    return;
  }
  const client = new Client({ connectionString: adminDbUrl });
  await client.connect();
  try {
    await client.query(`create database "${isolatedDbName}"`);
  } finally {
    await client.end();
  }
}

async function dropIsolatedDatabase(): Promise<void> {
  if (!shouldManageIsolatedDatabase()) {
    return;
  }
  const client = new Client({ connectionString: adminDbUrl });
  await client.connect();
  try {
    await client.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [isolatedDbName]);
    await client.query(`drop database if exists "${isolatedDbName}"`);
  } finally {
    await client.end();
  }
}

before(async (): Promise<any> => {
  await createIsolatedDatabase();
  const migrateModule = await import("../backend/database/migrate");
  await migrateModule.runMigrations();
  analyticsModule = await import("../backend/analytics/analytics.module");
});

after(async (): Promise<any> => {
  const { closeDatabasePool } = await import("../backend/database/client");
  await closeDatabasePool();
  await dropIsolatedDatabase();
  rmSync(tempRoot, { recursive: true, force: true });
});

test("analytics jobs persist checkpoints and support retry by failed job key", async () => {
  const jobService = analyticsModule.createAnalyticsJobService();
  const jobRepository = analyticsModule.createAnalyticsJobRepository();

  const rebuildResult = await jobService.runResultFactRebuild();
  assert.ok(rebuildResult.job_key.length > 0);

  const checkpointsAfterSuccess = await jobRepository.listCheckpoints();
  const factCheckpoint = checkpointsAfterSuccess.find((item) => item.job_type === "result_fact_rebuild");
  assert.ok(factCheckpoint);
  assert.equal(factCheckpoint?.checkpoint.last_status, "completed");

  const failedRun = await jobRepository.createRun({
    jobKey: "analytics-result-fact-failed",
    jobType: "result_fact_rebuild",
    status: "failed",
    scopeJson: "{}",
    metricsJson: "{}",
    errorMessage: "simulated failure",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  assert.equal(failedRun.status, "failed");

  const retryResult = await jobService.retryJob(failedRun.job_key);
  assert.ok(retryResult.job_key.length > 0);
  assert.notEqual(retryResult.job_key, failedRun.job_key);

  const checkpointsAfterRetry = await jobRepository.listCheckpoints();
  const retryCheckpoint = checkpointsAfterRetry.find((item) => item.job_type === "result_fact_rebuild");
  assert.ok(retryCheckpoint);
  assert.equal(retryCheckpoint?.checkpoint.last_status, "completed");
  assert.equal(typeof retryCheckpoint?.checkpoint.last_job_key, "string");

  const healthSummary = await jobService.getHealthSummary({
    result_fact_rebuild: 60_000,
    daily_snapshot_rebuild: 0
  });
  const factHealth = healthSummary.find((item) => item.job_type === "result_fact_rebuild");
  const snapshotHealth = healthSummary.find((item) => item.job_type === "daily_snapshot_rebuild");
  assert.equal(factHealth?.status, "healthy");
  assert.equal(snapshotHealth?.status, "disabled");
});
