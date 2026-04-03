import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";

const tempRoot = mkdtempSync(join(tmpdir(), "report-analytics-"));
const dataDir = join(tempRoot, "data");
const dbPath = join(dataDir, "report-system.sqlite");
mkdirSync(dataDir, { recursive: true });

process.env.REPORT_SYSTEM_DATA_DIR = dataDir;
process.env.REPORT_SYSTEM_DB_PATH = dbPath;
process.env.REPORT_SYSTEM_TENANT_ID = "demo";
process.env.REPORT_SYSTEM_TENANT_NAME = "示例客户";
process.env.REPORT_SYSTEM_BRAND_NAME = "示例报告系统";
process.env.REPORT_SYSTEM_BASE_URL = "http://127.0.0.1:3000";
process.env.REPORT_SYSTEM_ADMIN_USERNAME = "admin";
process.env.REPORT_SYSTEM_ADMIN_PASSWORD = "ChangeMe123!";
process.env.REPORT_SYSTEM_ADMIN_DISPLAY_NAME = "系统管理员";
process.env.REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS = "2";

let publishRoute: typeof import("../app/api/reports/publish/route");
let analyticsModule: typeof import("../backend/analytics/analytics.module");
let rectificationModule: typeof import("../backend/rectification/rectification.module");
let databaseClient: typeof import("../backend/database/client");
let databaseSchema: typeof import("../backend/database/schema");

function buildPublishPayload(input: {
  key: string;
  enterpriseId: string;
  enterpriseName: string;
  storeId: string;
  storeName: string;
  organizeName: string;
  organizeCode?: string;
  franchiseeName?: string;
  publishedAt: string;
  planId: string;
  planName: string;
  topic: string;
  withIssue: boolean;
}) {
  return {
    source_system: "vision-agent",
    payload_version: 2,
    idempotency_key: input.key,
    published_at: input.publishedAt,
    report: {
      report_meta: {
        report_type: "daily",
        topic: input.topic,
        plan_id: input.planId,
        plan_name: input.planName,
        report_versions: ["operations"],
        enterprise_id: input.enterpriseId,
        enterprise_name: input.enterpriseName,
        start_date: input.publishedAt.slice(0, 10),
        end_date: input.publishedAt.slice(0, 10),
        operator: "vision",
        generated_at: input.publishedAt
      },
      summary: {
        metrics: {
          store_count: 1,
          image_count: 1,
          issue_count: input.withIssue ? 1 : 0
        }
      },
      facts: {
        stores: [
          {
            store_id: input.storeId,
            store_code: `${input.storeId}-code`,
            store_name: input.storeName,
            organize_code: input.organizeCode || `${input.storeId}-org-code`,
            organize_name: input.organizeName,
            franchisee_name: input.franchiseeName || "默认加盟商",
            enterprise_id: input.enterpriseId,
            enterprise_name: input.enterpriseName
          }
        ],
        cameras: [
          {
            camera_id: `${input.storeId}-camera`,
            store_id: input.storeId,
            store_name: input.storeName,
            camera_index: 1,
            camera_alias: "门头"
          }
        ],
        captures: [
          {
            capture_id: `${input.key}-capture`,
            image_id: `${input.key}-image`,
            store_id: input.storeId,
            store_name: input.storeName,
            camera_id: `${input.storeId}-camera`,
            camera_index: 1,
            camera_alias: "门头",
            captured_at: input.publishedAt,
            capture_url: `https://example.com/${input.key}/capture.jpg`,
            preview_url: `https://example.com/${input.key}/preview.jpg`,
            oss_key: `oss/${input.key}/capture.jpg`,
            issue_count: input.withIssue ? 1 : 0
          }
        ],
        inspections: [
          {
            inspection_id: `${input.key}-inspection`,
            capture_id: `${input.key}-capture`,
            image_id: `${input.key}-image`,
            store_id: input.storeId,
            store_name: input.storeName,
            skill_id: "skill-001",
            skill_name: "货架完整性",
            status: "success",
            raw_result: "{\"ok\":true}",
            total_issues: input.withIssue ? 1 : 0
          }
        ],
        issues: input.withIssue
          ? [
              {
                issue_id: `${input.key}-issue`,
                inspection_id: `${input.key}-inspection`,
                capture_id: `${input.key}-capture`,
                image_id: `${input.key}-image`,
                store_id: input.storeId,
                store_name: input.storeName,
                skill_id: "skill-001",
                skill_name: "货架完整性",
                issue_type: "陈列问题",
                description: "货架未摆满",
                count: 1,
                severity: "medium",
                review_status: "pending",
                extra_json: { source: "analytics-test" }
              }
            ]
          : []
      }
    }
  };
}

before(async () => {
  await import("../backend/database/migrate");
  const [publishRouteModule, importedAnalyticsModule, importedRectificationModule, importedDatabaseClient, importedDatabaseSchema] =
    await Promise.all([
      import("../app/api/reports/publish/route"),
      import("../backend/analytics/analytics.module"),
      import("../backend/rectification/rectification.module"),
      import("../backend/database/client"),
      import("../backend/database/schema")
    ]);
  publishRoute = publishRouteModule;
  analyticsModule = importedAnalyticsModule;
  rectificationModule = importedRectificationModule;
  databaseClient = importedDatabaseClient;
  databaseSchema = importedDatabaseSchema;
});

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

test("analytics dashboard aggregates report facts and respects scope filters", async () => {
  const issuePublishResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/reports/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildPublishPayload({
          key: "analytics-issue",
          enterpriseId: "enterprise-a",
          enterpriseName: "企业A",
          storeId: "store-a",
          storeName: "门店A",
          organizeName: "组织A",
          organizeCode: "org-a",
          franchiseeName: "加盟商A",
          publishedAt: "2026-04-01 09:00:00",
          planId: "plan-a",
          planName: "计划A",
          topic: "智能巡检",
          withIssue: true
        })
      )
    })
  );
  assert.equal(issuePublishResp.status, 201);
  const issuePublishJson = (await issuePublishResp.json()) as { report_id: number };

  const passPublishResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/reports/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildPublishPayload({
          key: "analytics-pass",
          enterpriseId: "enterprise-b",
          enterpriseName: "企业B",
          storeId: "store-b",
          storeName: "门店B",
          organizeName: "组织B",
          organizeCode: "org-b",
          franchiseeName: "加盟商B",
          publishedAt: "2026-04-02 10:00:00",
          planId: "plan-b",
          planName: "计划B",
          topic: "智能巡检",
          withIssue: false
        })
      )
    })
  );
  assert.equal(passPublishResp.status, 201);

  const repeatIssuePublishResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/reports/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildPublishPayload({
          key: "analytics-issue-repeat",
          enterpriseId: "enterprise-a",
          enterpriseName: "企业A",
          storeId: "store-a",
          storeName: "门店A",
          organizeName: "组织A",
          organizeCode: "org-a",
          franchiseeName: "加盟商A",
          publishedAt: "2026-04-03 09:30:00",
          planId: "plan-a",
          planName: "计划A",
          topic: "智能巡检",
          withIssue: true
        })
      )
    })
  );
  assert.equal(repeatIssuePublishResp.status, 201);
  const repeatIssuePublishJson = (await repeatIssuePublishResp.json()) as { report_id: number };

  const factRebuild = analyticsModule.createAnalyticsFactService().rebuildAllFacts();
  assert.equal(factRebuild.result_row_count, 3);
  assert.equal(factRebuild.issue_row_count, 2);
  assert.equal(factRebuild.review_row_count, 0);
  assert.equal(factRebuild.rectification_row_count, 0);

  const factRows = analyticsModule.createAnalyticsFactRepository().listResultFacts();
  const issueFactRows = analyticsModule.createAnalyticsFactRepository().listIssueFacts();
  const issueFact = factRows.find((row) => row.source_enterprise_id === "enterprise-a");
  const repeatIssueFact = factRows.find(
    (row) => row.source_enterprise_id === "enterprise-a" && row.result_id !== issueFact?.result_id
  );
  const passFact = factRows.find((row) => row.source_enterprise_id === "enterprise-b");
  assert.ok(issueFact);
  assert.ok(repeatIssueFact);
  assert.ok(passFact);
  assert.equal(issueFactRows.length, 2);
  assert.equal(issueFactRows[0]?.issue_type, "陈列问题");
  assert.equal(issueFactRows[0]?.skill_id, "skill-001");
  assert.equal(issueFactRows[0]?.skill_name, "货架完整性");
  assert.equal(issueFactRows[0]?.severity, "medium");
  assert.equal(issueFact?.result_semantic_state, "issue_found");
  assert.equal(issueFact?.organization_code, "org-a");
  assert.equal(issueFact?.franchisee_name, "加盟商A");
  assert.equal(passFact?.result_semantic_state, "pass");
  assert.equal(passFact?.auto_completed, true);

  rectificationModule.createRectificationOrderRepository().create({
    report_id: issuePublishJson.report_id,
    result_id: issueFact!.result_id,
    store_id: "store-a",
    store_code: "store-a-code",
    store_name: "门店A",
    huiyunying_order_id: "HYY-001",
    request_description: "1. 货架未摆满",
    selected_issues: [{ id: 1, title: "货架未摆满" }],
    image_urls: ["https://example.com/analytics-issue/preview.jpg"],
    request_payload: { demo: true },
    response_payload: { demo: true },
    status: "created",
    if_corrected: "0",
    should_corrected: "2000-01-01",
    created_by: "system"
  });

  databaseClient.db
    .update(databaseSchema.reportImageTable)
    .set({
      reviewState: "completed",
      reviewedBy: "系统管理员",
      reviewedAt: "2026-04-02 11:00:00",
      reviewNote: "人工复核完成",
      reviewPayloadJson: JSON.stringify({ auto_completed: false })
    })
    .where(eq(databaseSchema.reportImageTable.id, issueFact!.result_id))
    .run();

  databaseClient.db.insert(databaseSchema.reportReviewLogTable).values({
    reportId: issuePublishJson.report_id,
    resultId: issueFact!.result_id,
    storeId: "store-a",
    storeName: "门店A",
    fromStatus: "pending",
    toStatus: "completed",
    operatorName: "系统管理员",
    note: "人工复核完成",
    metadataJson: JSON.stringify({ source: "analytics-test" }),
    createdAt: "2026-04-02 11:00:00"
  }).run();

  const factRebuildAfterActions = analyticsModule.createAnalyticsFactService().rebuildAllFacts();
  assert.equal(factRebuildAfterActions.result_row_count, 3);
  assert.equal(factRebuildAfterActions.issue_row_count, 2);
  assert.equal(factRebuildAfterActions.review_row_count, 1);
  assert.equal(factRebuildAfterActions.rectification_row_count, 1);

  const snapshotRebuild = analyticsModule.createAnalyticsSnapshotService().rebuildDailySnapshots();
  assert.equal(snapshotRebuild.overview_row_count, 3);
  assert.equal(snapshotRebuild.semantic_row_count, 3);

  const overviewSnapshots = analyticsModule.createAnalyticsSnapshotRepository().listDailyOverviewSnapshots();
  assert.equal(overviewSnapshots.length, 3);
  const issueOverviewSnapshot = overviewSnapshots.find((row) => row.source_enterprise_id === "enterprise-a");
  assert.ok(issueOverviewSnapshot);
  assert.equal(issueOverviewSnapshot?.rectification_order_count, 1);
  assert.equal(issueOverviewSnapshot?.rectification_pending_count, 1);

  const semanticSnapshots = analyticsModule.createAnalyticsSnapshotRepository().listDailySemanticSnapshots();
  assert.equal(semanticSnapshots.length, 3);

  const reviewFactRows = analyticsModule.createAnalyticsFactRepository().listReviewFacts();
  const rectificationFactRows = analyticsModule.createAnalyticsFactRepository().listRectificationFacts();
  assert.equal(reviewFactRows.length, 1);
  assert.equal(reviewFactRows[0]?.review_action, "complete");
  assert.equal(rectificationFactRows.length, 1);
  assert.equal(rectificationFactRows[0]?.overdue, true);

  const jobRunResult = analyticsModule.createAnalyticsJobService().runDailySnapshotRebuild();
  assert.ok(jobRunResult.job_key);
  assert.equal(jobRunResult.overview_row_count, 3);
  const jobRuns = analyticsModule.createAnalyticsJobRepository().listRuns();
  assert.ok(jobRuns.length >= 1);
  assert.equal(jobRuns[0]?.status, "completed");

  const analyticsService = analyticsModule.createAnalyticsService();
  const dashboard = analyticsService.getDashboard(
    {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      topic: "智能巡检"
    },
    {}
  );

  assert.equal(dashboard.overview.report_count, 3);
  assert.equal(dashboard.overview.store_count, 2);
  assert.equal(dashboard.overview.result_count, 3);
  assert.equal(dashboard.overview.issue_count, 2);
  assert.equal(dashboard.overview.pending_review_count, 1);
  assert.equal(dashboard.overview.completed_review_count, 2);
  assert.equal(dashboard.overview.auto_completed_review_count, 1);
  assert.equal(dashboard.overview.manual_completed_review_count, 1);
  assert.equal(dashboard.overview.rectification_order_count, 1);
  assert.equal(dashboard.overview.rectification_completed_count, 0);
  assert.equal(dashboard.overview.rectification_pending_count, 1);
  assert.equal(dashboard.overview.rectification_overdue_count, 1);
  assert.equal(dashboard.overview.rectification_close_rate, 0);

  assert.deepEqual(
    dashboard.semantic_distribution.map((item) => [item.state, item.count]),
    [
      ["issue_found", 2],
      ["pass", 1],
      ["inconclusive", 0],
      ["inspection_failed", 0]
    ]
  );

  assert.equal(dashboard.issue_type_ranking.length, 1);
  assert.equal(dashboard.issue_type_ranking[0]?.issue_type, "陈列问题");
  assert.equal(dashboard.issue_type_ranking[0]?.count, 2);
  assert.equal(dashboard.skill_distribution.length, 1);
  assert.equal(dashboard.skill_distribution[0]?.skill_id, "skill-001");
  assert.equal(dashboard.skill_distribution[0]?.skill_name, "货架完整性");
  assert.equal(dashboard.skill_distribution[0]?.count, 2);
  assert.equal(dashboard.severity_distribution.length, 1);
  assert.equal(dashboard.severity_distribution[0]?.severity, "medium");
  assert.equal(dashboard.severity_distribution[0]?.label, "中");
  assert.equal(dashboard.severity_distribution[0]?.count, 2);
  assert.equal(dashboard.daily_trend.length, 3);
  assert.equal(dashboard.daily_trend[0]?.snapshot_date, "2026-04-01");
  assert.equal(dashboard.daily_trend[0]?.rectification_order_count, 1);
  assert.equal(dashboard.organization_ranking.length, 2);
  assert.equal(dashboard.organization_ranking[0]?.organization_code, "org-a");
  assert.equal(dashboard.organization_ranking[0]?.organization_name, "组织A");
  assert.equal(dashboard.organization_ranking[0]?.issue_count, 2);
  assert.equal(dashboard.organization_ranking[0]?.pending_review_count, 1);
  assert.equal(dashboard.organization_governance_ranking.length, 1);
  assert.equal(dashboard.organization_governance_ranking[0]?.organization_code, "org-a");
  assert.ok((dashboard.organization_governance_ranking[0]?.governance_score || 0) > 0);
  assert.equal(dashboard.franchisee_ranking.length, 2);
  assert.equal(dashboard.franchisee_ranking[0]?.franchisee_name, "加盟商A");
  assert.equal(dashboard.franchisee_ranking[0]?.issue_count, 2);
  assert.equal(dashboard.franchisee_close_rate_ranking.length, 1);
  assert.equal(dashboard.franchisee_close_rate_ranking[0]?.franchisee_name, "加盟商A");
  assert.equal(dashboard.franchisee_close_rate_ranking[0]?.close_rate, 0);
  assert.equal(dashboard.high_risk_franchisees.length, 1);
  assert.equal(dashboard.high_risk_franchisees[0]?.franchisee_name, "加盟商A");
  assert.ok((dashboard.high_risk_franchisees[0]?.risk_score || 0) > 0);
  assert.equal(dashboard.recurring_stores.length, 1);
  assert.equal(dashboard.recurring_stores[0]?.store_id, "store-a");
  assert.equal(dashboard.recurring_stores[0]?.abnormal_day_count, 2);
  assert.equal(dashboard.recurring_franchisees.length, 1);
  assert.equal(dashboard.recurring_franchisees[0]?.franchisee_name, "加盟商A");
  assert.equal(dashboard.recurring_franchisees[0]?.recurring_store_count, 1);
  assert.equal(dashboard.store_ranking.length, 2);
  assert.equal(dashboard.store_ranking[0]?.store_id, "store-a");
  assert.equal(dashboard.store_ranking[0]?.franchisee_name, "加盟商A");
  assert.equal(dashboard.store_ranking[0]?.rectification_required_count, 2);
  assert.equal(dashboard.review_efficiency.review_action_count, 1);
  assert.equal(dashboard.review_efficiency.manual_completed_count, 1);
  assert.equal(dashboard.review_efficiency.operator_count, 1);
  assert.ok(dashboard.review_efficiency.average_review_latency_hours > 0);
  assert.deepEqual(
    dashboard.review_status_distribution.map((item) => [item.review_state, item.count]),
    [
      ["pending", 1],
      ["manual_completed", 1],
      ["auto_completed", 1]
    ]
  );
  assert.equal(dashboard.rectification_overdue_ranking.length, 1);
  assert.equal(dashboard.rectification_overdue_ranking[0]?.store_id, "store-a");
  assert.equal(dashboard.rectification_overdue_ranking[0]?.overdue_count, 1);
  assert.equal(dashboard.overdue_franchisees.length, 1);
  assert.equal(dashboard.overdue_franchisees[0]?.franchisee_name, "加盟商A");
  assert.equal(dashboard.overdue_franchisees[0]?.overdue_count, 1);
  assert.equal(dashboard.rectification_overview.order_count, 1);
  assert.equal(dashboard.rectification_overview.pending_count, 1);
  assert.equal(dashboard.rectification_overview.overdue_count, 1);
  assert.equal(dashboard.rectification_overview.average_rectification_duration_days, 0);

  const scopedDashboard = analyticsService.getDashboard(
    {
      startDate: "2026-04-01",
      endDate: "2026-04-03"
    },
    {
      enterpriseScopeIds: ["enterprise-a"]
    }
  );

  assert.equal(scopedDashboard.overview.report_count, 2);
  assert.equal(scopedDashboard.overview.store_count, 1);
  assert.equal(scopedDashboard.overview.result_count, 2);
  assert.equal(scopedDashboard.overview.issue_count, 2);
  assert.equal(scopedDashboard.semantic_distribution.find((item) => item.state === "pass")?.count, 0);
  assert.equal(scopedDashboard.daily_trend.length, 2);
  assert.equal(scopedDashboard.organization_ranking.length, 1);
  assert.equal(scopedDashboard.organization_governance_ranking.length, 1);
  assert.equal(scopedDashboard.franchisee_ranking.length, 1);
  assert.equal(scopedDashboard.franchisee_close_rate_ranking.length, 1);
  assert.equal(scopedDashboard.high_risk_franchisees.length, 1);
  assert.equal(scopedDashboard.recurring_stores.length, 1);
  assert.equal(scopedDashboard.recurring_franchisees.length, 1);
  assert.equal(scopedDashboard.store_ranking.length, 1);
  assert.equal(scopedDashboard.review_efficiency.review_action_count, 1);
  assert.equal(scopedDashboard.rectification_overdue_ranking.length, 1);

  const franchiseeDashboard = analyticsService.getDashboard(
    {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      franchiseeName: "加盟商A"
    },
    {}
  );
  assert.equal(franchiseeDashboard.overview.report_count, 2);
  assert.equal(franchiseeDashboard.overview.issue_count, 2);
  assert.equal(franchiseeDashboard.franchisee_ranking.length, 1);
  assert.equal(franchiseeDashboard.franchisee_ranking[0]?.franchisee_name, "加盟商A");
  assert.equal(franchiseeDashboard.franchisee_close_rate_ranking.length, 1);
  assert.equal(franchiseeDashboard.high_risk_franchisees.length, 1);
  assert.equal(franchiseeDashboard.recurring_stores.length, 1);
  assert.equal(franchiseeDashboard.recurring_franchisees.length, 1);

  rectificationModule.createRectificationOrderRepository().create({
    report_id: repeatIssuePublishJson.report_id,
    result_id: repeatIssueFact!.result_id,
    store_id: "store-a",
    store_code: "store-a-code",
    store_name: "门店A",
    huiyunying_order_id: "HYY-002",
    request_description: "1. 第二次货架未摆满",
    selected_issues: [{ id: 2, title: "第二次货架未摆满" }],
    image_urls: ["https://example.com/analytics-issue-repeat/preview.jpg"],
    request_payload: { demo: true },
    response_payload: { demo: true },
    status: "created",
    if_corrected: "0",
    should_corrected: "2026-04-05",
    created_by: "system"
  });

  databaseClient.db
    .update(databaseSchema.reportRectificationOrderTable)
    .set({
      ifCorrected: "1",
      status: "completed",
      createdAt: "2026-04-02 08:00:00",
      updatedAt: "2026-04-04 08:00:00",
      realCorrectedTime: "2026-04-04 08:00:00"
    })
    .where(eq(databaseSchema.reportRectificationOrderTable.huiYunYingOrderId, "HYY-002"))
    .run();

  analyticsModule.createAnalyticsFactService().rebuildAllFacts();
  const durationDashboard = analyticsService.getDashboard(
    {
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      topic: "智能巡检"
    },
    {}
  );
  assert.equal(durationDashboard.rectification_overview.average_rectification_duration_days, 2);
});
