import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, after, test } from "node:test";

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => ({});

const tempRoot = mkdtempSync(join(tmpdir(), "report-review-"));
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

let loginRoute: typeof import("../app/api/auth/login/route");
let publishRoute: typeof import("../app/api/reports/publish/route");
let reportRoute: typeof import("../app/api/reports/[reportId]/route");
let reviewRoute: typeof import("../app/api/reports/[reportId]/images/[imageId]/review-status/route");
let reviewLogsRoute: typeof import("../app/api/reports/[reportId]/review-logs/route");
let authService: typeof import("../backend/auth/auth.module");
let reportServiceModule: typeof import("../backend/report/report.module");
let ReportDetailView: typeof import("../ui/report-detail-view").ReportDetailView;
let ReportResultDetailView: typeof import("../ui/report-result-detail-view").ReportResultDetailView;

const publishPayload = {
  source_system: "vision-agent",
  payload_version: 2,
  idempotency_key: "review-test-001",
  published_at: "2026-03-25 10:00:00",
  report: {
    report_meta: {
      topic: "智能巡检",
      report_versions: ["operations"],
      enterprise_id: "demo",
      enterprise_name: "示例客户",
      start_date: "2026-03-25",
      end_date: "2026-03-25",
      operator: "vision",
      generated_at: "2026-03-25 10:00:00"
    },
    summary: {
      metrics: {
        store_count: 1,
        image_count: 1,
        issue_count: 1
      }
    },
    facts: {
      stores: [
        {
          store_id: "store-001",
          store_code: "demo001",
          store_name: "测试门店",
          organize_name: "示例组织",
          enterprise_id: "demo",
          enterprise_name: "示例客户"
        }
      ],
      cameras: [
        {
          camera_id: "camera-001",
          store_id: "store-001",
          store_name: "测试门店",
          camera_index: 1,
          camera_alias: "门头",
          camera_device_code: "dev-001"
        }
      ],
      captures: [
        {
          capture_id: "capture-001",
          image_id: "image-001",
          store_id: "store-001",
          store_name: "测试门店",
          camera_id: "camera-001",
          camera_index: 1,
          camera_alias: "门头",
          camera_device_code: "dev-001",
          capture_provider: "hyy",
          captured_at: "2026-03-25 09:59:30",
          capture_url: "https://example.com/capture.jpg",
          preview_url: "https://example.com/preview.jpg",
          oss_key: "oss/demo/capture.jpg",
          issue_count: 1
        }
      ],
      inspections: [
        {
          inspection_id: "inspection-001",
          capture_id: "capture-001",
          image_id: "image-001",
          store_id: "store-001",
          store_name: "测试门店",
          skill_id: "skill-001",
          skill_name: "货架完整性",
          status: "success",
          raw_result: "{\"ok\":true}",
          total_issues: 1
        }
      ],
      issues: [
        {
          issue_id: "issue-001",
          inspection_id: "inspection-001",
          capture_id: "capture-001",
          image_id: "image-001",
          store_id: "store-001",
          store_name: "测试门店",
          skill_id: "skill-001",
          skill_name: "货架完整性",
          issue_type: "货架未摆满",
          description: "货架未摆满",
          count: 1,
          severity: "medium",
          review_status: "pending",
          extra_json: { source: "test" }
        }
      ]
    }
  }
};

before(async () => {
  await import("../backend/database/migrate");
  const [
    authModule,
    reportModule,
    reportDetailViewModule,
    reportResultDetailViewModule,
    importedLoginRoute,
    importedPublishRoute,
    importedReportRoute,
    importedReviewRoute,
    importedReviewLogsRoute
  ] = await Promise.all([
    import("../backend/auth/auth.module"),
    import("../backend/report/report.module"),
    import("../ui/report-detail-view"),
    import("../ui/report-result-detail-view"),
    import("../app/api/auth/login/route"),
    import("../app/api/reports/publish/route"),
    import("../app/api/reports/[reportId]/route"),
    import("../app/api/reports/[reportId]/images/[imageId]/review-status/route"),
    import("../app/api/reports/[reportId]/review-logs/route")
  ]);
  authService = authModule;
  reportServiceModule = reportModule;
  ReportDetailView = reportDetailViewModule.ReportDetailView;
  ReportResultDetailView = reportResultDetailViewModule.ReportResultDetailView;
  loginRoute = importedLoginRoute;
  publishRoute = importedPublishRoute;
  reportRoute = importedReportRoute;
  reviewRoute = importedReviewRoute;
  reviewLogsRoute = importedReviewLogsRoute;
  authService.createAuthService().ensureBootstrap();
});

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

test("image review status updates persist and render recent logs", async () => {
  const loginResp = await loginRoute.POST(
    new Request("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      body: (() => {
        const formData = new FormData();
        formData.set("username", "admin");
        formData.set("password", "ChangeMe123!");
        return formData;
      })()
    })
  );
  assert.equal(loginResp.status, 303);
  const sessionCookie = loginResp.headers.get("set-cookie") || "";
  assert.ok(sessionCookie.includes("report_system_session="));

  const publishResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/reports/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(publishPayload)
    })
  );
  assert.equal(publishResp.status, 201);
  const publishJson = (await publishResp.json()) as { report_id: number };
  assert.ok(publishJson.report_id > 0);
  const reportId = publishJson.report_id;

  const detailResp = await reportRoute.GET(new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }), {
    params: Promise.resolve({ reportId: String(reportId) })
  });
  assert.equal(detailResp.status, 200);
  const detailJson = (await detailResp.json()) as { report: { id: number; progress_state: string; images: Array<{ id: number; review_state: string }>; review_logs: Array<{ id: number }> } };
  assert.equal(detailJson.report.progress_state, "pending");
  assert.equal(detailJson.report.images.length, 1);

  const imageId = detailJson.report.images[0].id;
  const reviewResp = await reviewRoute.POST(
    new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({
        review_status: "completed"
      })
    }),
    {
      params: Promise.resolve({ reportId: "1", imageId: String(imageId) })
    }
  );
  assert.equal(reviewResp.status, 200);
  const reviewJson = (await reviewResp.json()) as {
    changed: boolean;
    result_id: number;
    from_status: string;
    to_status: string;
    progress_state: string;
    completed_result_count: number;
    total_result_count: number;
    recent_log: { operator_name: string } | null;
  };
  assert.equal(reviewJson.changed, true);
  assert.equal(reviewJson.result_id, imageId);
  assert.equal(reviewJson.from_status, "pending");
  assert.equal(reviewJson.to_status, "completed");
  assert.equal(reviewJson.progress_state, "completed");
  assert.equal(reviewJson.completed_result_count, 1);
  assert.equal(reviewJson.total_result_count, 1);
  assert.equal(reviewJson.recent_log?.operator_name, "系统管理员");

  const updatedDetailResp = await reportRoute.GET(new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }), {
    params: Promise.resolve({ reportId: String(reportId) })
  });
  const updatedDetailJson = (await updatedDetailResp.json()) as {
    report: {
      progress_state: string;
      images: Array<{ id: number; review_state: string }>;
      review_logs: Array<{ operator_name: string; to_status: string }>;
    };
  };
  assert.equal(updatedDetailJson.report.progress_state, "completed");
  assert.equal(updatedDetailJson.report.images[0].review_state, "completed");
  assert.equal(updatedDetailJson.report.review_logs.length, 1);
  assert.equal(updatedDetailJson.report.review_logs[0].operator_name, "系统管理员");
  assert.equal(updatedDetailJson.report.review_logs[0].to_status, "completed");

  const logsResp = await reviewLogsRoute.GET(new Request(`http://127.0.0.1:3000/api/reports/${reportId}/review-logs?limit=20`, { headers: { cookie: sessionCookie } }), {
    params: Promise.resolve({ reportId: String(reportId) })
  });
  assert.equal(logsResp.status, 200);
  const logsJson = (await logsResp.json()) as { count: number; logs: Array<{ operator_name: string }> };
  assert.equal(logsJson.count, 1);
  assert.equal(logsJson.logs[0].operator_name, "系统管理员");

  const pageJsx = ReportDetailView({
    currentUser: authService.createAuthService().getSessionUser(sessionCookie.split(";")[0].split("=")[1])!,
    filters: { organization: "", storeId: "", reviewStatus: "", page: 1, pageSize: 30 },
    report: reportServiceModule.createReportService().getReportDetail(reportId)!,
    showCollaboration: true
  });
  const pageHtml = renderToStaticMarkup(pageJsx as ReactElement);
  assert.ok(pageHtml.includes("协作记录"));
  assert.ok(pageHtml.includes("系统管理员"));
  assert.ok(pageHtml.includes("结果清单"));

  const resultPageJsx = ReportResultDetailView({
    activeInspectionId: "",
    activePanel: "review",
    currentUser: authService.createAuthService().getSessionUser(sessionCookie.split(";")[0].split("=")[1])!,
    filters: { organization: "", storeId: "", reviewStatus: "", page: 1, pageSize: 30 },
    previewImage: false,
    report: reportServiceModule.createReportService().getReportDetail(reportId)!,
    resultId: imageId
  });
  const resultPageHtml = renderToStaticMarkup(resultPageJsx as ReactElement);
  assert.ok(resultPageHtml.includes("最近记录"));
  assert.ok(resultPageHtml.includes("确认已复核"));
  assert.ok(resultPageHtml.includes("货架完整性"));
  assert.ok(resultPageHtml.includes("返回列表"));
});

test("publish rejects unsupported payload_version with 422", async () => {
  const publishResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/reports/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...publishPayload,
        idempotency_key: "review-test-unsupported-version",
        payload_version: 3
      })
    })
  );
  assert.equal(publishResp.status, 422);

  const publishJson = (await publishResp.json()) as {
    success: boolean;
    error: string;
    received_payload_version: number;
    supported_payload_versions: number[];
  };

  assert.equal(publishJson.success, false);
  assert.equal(publishJson.error, "Unsupported payload_version.");
  assert.equal(publishJson.received_payload_version, 3);
  assert.deepEqual(publishJson.supported_payload_versions, [2]);
});
