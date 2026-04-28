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
let rolesSaveRoute: typeof import("../app/admin/roles/save/route");
let authService: typeof import("../backend/auth/auth.module");
let reportServiceModule: typeof import("../backend/report/report.module");
let systemSettingsModule: typeof import("../backend/system-settings/system-settings.module");
let rectificationModule: typeof import("../backend/rectification/rectification.module");
let ReportDetailView: typeof import("../ui/report/report-detail-view").ReportDetailView;

const publishPayload = {
  source_system: "vision-agent",
  payload_version: 2,
  idempotency_key: "review-test-001",
  published_at: "2026-03-25 10:00:00",
  report: {
    report_meta: {
      report_type: "daily",
      topic: "智能巡检",
      plan_id: "plan-demo-001",
      plan_name: "演示巡检计划",
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
    importedSystemSettingsModule,
    importedRectificationModule,
    reportDetailViewModule,
    importedLoginRoute,
    importedPublishRoute,
    importedReportRoute,
    importedReviewRoute,
    importedReviewLogsRoute,
    importedRolesSaveRoute
  ] = await Promise.all([
    import("../backend/auth/auth.module"),
    import("../backend/report/report.module"),
    import("../backend/system-settings/system-settings.module"),
    import("../backend/rectification/rectification.module"),
    import("../ui/report/report-detail-view"),
    import("../app/api/auth/login/route"),
    import("../app/api/reports/publish/route"),
    import("../app/api/reports/[reportId]/route"),
    import("../app/api/reports/[reportId]/images/[imageId]/review-status/route"),
    import("../app/api/reports/[reportId]/review-logs/route"),
    import("../app/admin/roles/save/route")
  ]);
  authService = authModule;
  reportServiceModule = reportModule;
  systemSettingsModule = importedSystemSettingsModule;
  rectificationModule = importedRectificationModule;
  ReportDetailView = reportDetailViewModule.ReportDetailView;
  loginRoute = importedLoginRoute;
  publishRoute = importedPublishRoute;
  reportRoute = importedReportRoute;
  reviewRoute = importedReviewRoute;
  reviewLogsRoute = importedReviewLogsRoute;
  rolesSaveRoute = importedRolesSaveRoute;
  authService.createAuthService().ensureBootstrap();
  systemSettingsModule.createSystemSettingsService().saveHuiYunYingApiSettings({
    uri: "https://huiyunying.example.com",
    route: "/route",
    appid: "appid-demo",
    secret: "secret-demo",
    rateLimitCount: 30,
    rateLimitWindowMs: 60000,
    rectificationCreateRoute: "/route/ri/open/item/create",
    rectificationListRoute: "/route/ri/open/item/list",
    rectificationDescriptionMaxLength: 500,
    defaultShouldCorrectedDays: 0,
    rectificationSyncIntervalMs: 600000,
    rectificationSyncRetryCount: 2,
    rectificationSyncTimeoutMs: 10000,
    rectificationSyncBatchSize: 50,
    analyticsFactRefreshIntervalMs: 0,
    analyticsSnapshotRefreshIntervalMs: 0
  });
});

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

test("image review status updates persist and render recent logs", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init });
    if (url.includes("/sign")) {
      return new Response("token-123", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }
    if (url.includes("/route/ri/open/item/create")) {
      return new Response(JSON.stringify({ status: 200, data: true, disqualifiedId: 9001 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
  const detailJson = (await detailResp.json()) as {
    report: {
      id: number;
      progress_state: string;
      report_type: string;
      report_topic: string;
      plan_name: string;
      images: Array<{ id: number; review_state: string }>;
      review_logs: Array<{ id: number }>;
    };
  };
  assert.equal(detailJson.report.progress_state, "pending");
  assert.equal(detailJson.report.report_type, "daily");
  assert.equal(detailJson.report.report_topic, "智能巡检");
  assert.equal(detailJson.report.plan_name, "演示巡检计划");
  assert.equal(detailJson.report.images.length, 1);

  const imageId = detailJson.report.images[0].id;
  const reviewResp = await reviewRoute.POST(
    new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({
        review_status: "completed",
        selected_issues_json: JSON.stringify([{ id: 1, title: "货架未摆满" }]),
        should_corrected: "2026-04-05"
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
    selected_issues: Array<{ id: number; title: string }>;
    rectification_orders: Array<{ id: number; huiyunying_order_id: string | null; status: string }>;
    recent_log: { operator_name: string } | null;
  };
  assert.equal(reviewJson.changed, true);
  assert.equal(reviewJson.result_id, imageId);
  assert.equal(reviewJson.from_status, "pending");
  assert.equal(reviewJson.to_status, "completed");
  assert.equal(reviewJson.progress_state, "completed");
  assert.equal(reviewJson.completed_result_count, 1);
  assert.equal(reviewJson.total_result_count, 1);
  assert.equal(reviewJson.selected_issues.length, 1);
  assert.equal(reviewJson.selected_issues[0].title, "货架未摆满");
  assert.equal(reviewJson.rectification_orders.length, 1);
  assert.equal(reviewJson.rectification_orders[0].huiyunying_order_id, "9001");
  assert.equal(reviewJson.recent_log?.operator_name, "系统管理员");
  assert.equal(fetchCalls.length, 2);

  const updatedDetailResp = await reportRoute.GET(new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }), {
    params: Promise.resolve({ reportId: String(reportId) })
  });
  const updatedDetailJson = (await updatedDetailResp.json()) as {
    report: {
      progress_state: string;
      images: Array<{ id: number; review_state: string }>;
      review_logs: Array<{ operator_name: string; to_status: string; metadata: { selected_issues?: Array<{ id: number; title: string }> } }>;
    };
  };
  assert.equal(updatedDetailJson.report.progress_state, "completed");
  assert.equal(updatedDetailJson.report.images[0].review_state, "completed");
  assert.equal(updatedDetailJson.report.review_logs.length, 1);
  assert.equal(updatedDetailJson.report.review_logs[0].operator_name, "系统管理员");
  assert.equal(updatedDetailJson.report.review_logs[0].to_status, "completed");
  assert.equal(updatedDetailJson.report.review_logs[0].metadata.selected_issues?.length, 1);

  const logsResp = await reviewLogsRoute.GET(new Request(`http://127.0.0.1:3000/api/reports/${reportId}/review-logs?limit=20`, { headers: { cookie: sessionCookie } }), {
    params: Promise.resolve({ reportId: String(reportId) })
  });
  assert.equal(logsResp.status, 200);
  const logsJson = (await logsResp.json()) as { count: number; logs: Array<{ operator_name: string }> };
  assert.equal(logsJson.count, 1);
  assert.equal(logsJson.logs[0].operator_name, "系统管理员");

  const pageJsx = ReportDetailView({
    currentUser: authService.createAuthService().getSessionUser(sessionCookie.split(";")[0].split("=")[1])!,
    filters: { organization: "", storeId: "", reviewStatus: "", semanticState: "", page: 1, pageSize: 30 },
    report: reportServiceModule.createReportService().getReportDetail(reportId)!,
    showCollaboration: true
  });
  const pageHtml = renderToStaticMarkup(pageJsx as ReactElement);
  assert.ok(pageHtml.includes("协作记录"));
  assert.ok(pageHtml.includes("系统管理员"));
  assert.ok(pageHtml.includes("结果清单"));

  const rectificationOrders = rectificationModule.createRectificationService().listByResultId(imageId);
  assert.equal(rectificationOrders.length, 1);
  assert.equal(rectificationOrders[0].huiyunying_order_id, "9001");
  assert.equal(rectificationOrders[0].selected_issues.length, 1);
  assert.equal(rectificationOrders[0].selected_issues[0].title, "货架未摆满");

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/sign")) {
      return new Response("token-123", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }
    if (url.includes("/route/ri/open/item/list")) {
      return new Response(
        JSON.stringify({
          status: 200,
          data: [
            {
              disqualifiedId: 9001,
              ifCorrected: "1",
              storeCode: "demo001",
              description: "1. 货架未摆满",
              realCorrectedTime: "2026-04-02 12:00:00"
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
    throw new Error(`Unexpected sync fetch url: ${url}`);
  }) as typeof fetch;

  const syncedOrders = await rectificationModule.createRectificationService().syncOrdersByResultId(imageId);
  assert.equal(syncedOrders.length, 1);
  assert.equal(syncedOrders[0].if_corrected, "1");
  assert.equal(syncedOrders[0].status, "corrected");
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("review submit sends annotation images for selected issues across scenes", async () => {
  const originalFetch = globalThis.fetch;
  const createBodies: Array<{ description?: string; imageUrls?: string[] }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/sign")) {
      return new Response("token-123", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }
    if (url.includes("/route/ri/open/item/create")) {
      createBodies.push(JSON.parse(String(init?.body || "{}")) as { description?: string; imageUrls?: string[] });
      return new Response(JSON.stringify({ status: 200, data: true, disqualifiedId: 9101 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-multi-scene-images",
          published_at: "2026-04-03 10:00:00",
          report: {
            ...publishPayload.report,
            summary: {
              metrics: {
                store_count: 1,
                image_count: 1,
                issue_count: 1
              }
            },
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-04-03",
              end_date: "2026-04-03",
              generated_at: "2026-04-03 10:00:00"
            },
            facts: {
              ...publishPayload.report.facts,
              inspections: [
                {
                  ...publishPayload.report.facts.inspections[0],
                  inspection_id: "inspection-active-a",
                  skill_id: "skill-a",
                  skill_name: "技能 A",
                  raw_result: "发现问题",
                  evidence_image_url: "https://example.com/evidence-a.jpg",
                  original_image_url: "https://example.com/original-a.jpg",
                  total_issues: 1
                },
                {
                  ...publishPayload.report.facts.inspections[0],
                  inspection_id: "inspection-active-b",
                  skill_id: "skill-b",
                  skill_name: "技能 B",
                  raw_result: "发现问题",
                  evidence_image_url: "https://example.com/evidence-b.jpg",
                  total_issues: 1
                }
              ],
              issues: [
                {
                  ...publishPayload.report.facts.issues[0],
                  issue_id: "issue-active-a",
                  inspection_id: "inspection-active-a",
                  skill_id: "skill-a",
                  skill_name: "技能 A",
                  issue_type: "技能 A 问题",
                  description: "技能 A 问题",
                  evidence_image_url: "https://example.com/evidence-a.jpg"
                },
                {
                  ...publishPayload.report.facts.issues[0],
                  issue_id: "issue-active-b",
                  inspection_id: "inspection-active-b",
                  skill_id: "skill-b",
                  skill_name: "技能 B",
                  issue_type: "技能 B 问题",
                  description: "技能 B 问题",
                  evidence_image_url: "https://example.com/evidence-b.jpg"
                }
              ]
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as {
      report: {
        images: Array<{ id: number; review_state: string }>;
        issues: Array<{ id: number; title: string }>;
      };
    };
    const imageId = detailJson.report.images[0].id;
    assert.equal(detailJson.report.images[0].review_state, "pending");
    const selectedIssues = detailJson.report.issues.map((issue) => ({ id: issue.id, title: issue.title }));
    assert.equal(selectedIssues.length, 2);

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          active_inspection_id: "inspection-active-a",
          failed_inspection_id: "inspection-active-a",
          selected_issues_json: JSON.stringify(selectedIssues),
          rectification_image_urls_json: JSON.stringify(["https://example.com/evidence-a.jpg"]),
          should_corrected: "2026-04-05",
          result_semantic_state: "issue_found",
          note: "跨场景勾选问题，下发各自标注图。"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 200);
    const reviewJson = (await reviewResp.json()) as {
      result_semantic_state: string | null;
      rectification_orders: Array<{ huiyunying_order_id: string | null }>;
      selected_issues: Array<unknown>;
      to_status: string;
    };
    assert.equal(reviewJson.result_semantic_state, "issue_found");
    assert.equal(reviewJson.to_status, "completed");
    assert.equal(reviewJson.selected_issues.length, 2);
    assert.equal(reviewJson.rectification_orders.length, 1);
    assert.equal(reviewJson.rectification_orders[0].huiyunying_order_id, "9101");
    assert.equal(createBodies.length, 1);
    assert.deepEqual(createBodies[0].imageUrls, [
      "https://example.com/original-a.jpg",
      "https://example.com/evidence-b.jpg"
    ]);
    assert.match(createBodies[0].description || "", /技能 A 问题（对应图片：第1张）/);
    assert.match(createBodies[0].description || "", /技能 B 问题（对应图片：第2张）/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("review submit splits orders when selected issue images exceed ten", async () => {
  const originalFetch = globalThis.fetch;
  const createBodies: Array<{ description?: string; imageUrls?: string[] }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/sign")) {
      return new Response("token-123", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }
    if (url.includes("/route/ri/open/item/create")) {
      createBodies.push(JSON.parse(String(init?.body || "{}")) as { description?: string; imageUrls?: string[] });
      return new Response(JSON.stringify({ status: 200, data: true, disqualifiedId: 9200 + createBodies.length }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";
    const inspections = Array.from({ length: 11 }, (_, index) => ({
      ...publishPayload.report.facts.inspections[0],
      inspection_id: `inspection-split-${index + 1}`,
      skill_id: `skill-split-${index + 1}`,
      skill_name: `技能 ${index + 1}`,
      evidence_image_url: `https://example.com/split-${index + 1}.jpg`,
      total_issues: 1
    }));
    const issues = Array.from({ length: 11 }, (_, index) => ({
      ...publishPayload.report.facts.issues[0],
      issue_id: `issue-split-${index + 1}`,
      inspection_id: `inspection-split-${index + 1}`,
      skill_id: `skill-split-${index + 1}`,
      skill_name: `技能 ${index + 1}`,
      issue_type: `问题 ${index + 1}`,
      description: `问题 ${index + 1}`,
      evidence_image_url: `https://example.com/split-${index + 1}.jpg`
    }));

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-split-by-image-count",
          published_at: "2026-04-06 10:00:00",
          report: {
            ...publishPayload.report,
            summary: {
              metrics: {
                store_count: 1,
                image_count: 1,
                issue_count: 11
              }
            },
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-04-06",
              end_date: "2026-04-06",
              generated_at: "2026-04-06 10:00:00"
            },
            facts: {
              ...publishPayload.report.facts,
              inspections,
              issues
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as {
      report: {
        images: Array<{ id: number }>;
        issues: Array<{ id: number; title: string }>;
      };
    };
    const imageId = detailJson.report.images[0].id;
    const selectedIssues = detailJson.report.issues.map((issue) => ({ id: issue.id, title: issue.title }));

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          selected_issues_json: JSON.stringify(selectedIssues),
          should_corrected: "2026-04-08",
          result_semantic_state: "issue_found"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 200);
    assert.equal(createBodies.length, 2);
    assert.equal(createBodies[0].imageUrls?.length, 10);
    assert.deepEqual(createBodies[1].imageUrls, ["https://example.com/split-11.jpg"]);
    assert.match(createBodies[1].description || "", /11\. 问题 11（对应图片：第1张）/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("review submit rejects issue result without selected issues", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<string> = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-empty-selected-issues",
          published_at: "2026-04-04 10:00:00",
          report: {
            ...publishPayload.report,
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-04-04",
              end_date: "2026-04-04",
              generated_at: "2026-04-04 10:00:00"
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as { report: { images: Array<{ id: number }> } };
    const imageId = detailJson.report.images[0].id;

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          selected_issues_json: JSON.stringify([]),
          should_corrected: "2026-04-05",
          result_semantic_state: "issue_found"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 400);
    const reviewJson = (await reviewResp.json()) as { error: string; success: boolean };
    assert.equal(reviewJson.success, false);
    assert.equal(reviewJson.error, "请至少勾选一个问题项后再创建整改单。");
    assert.equal(fetchCalls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("review submit rejects selected issue without any deliverable image", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<string> = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-missing-issue-image",
          published_at: "2026-04-07 10:00:00",
          report: {
            ...publishPayload.report,
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-04-07",
              end_date: "2026-04-07",
              generated_at: "2026-04-07 10:00:00"
            },
            facts: {
              ...publishPayload.report.facts,
              captures: [
                {
                  ...publishPayload.report.facts.captures[0],
                  capture_url: undefined,
                  preview_url: undefined,
                  oss_key: undefined
                }
              ],
              inspections: [
                {
                  ...publishPayload.report.facts.inspections[0],
                  evidence_image_url: undefined,
                  original_image_url: undefined
                }
              ],
              issues: [
                {
                  ...publishPayload.report.facts.issues[0],
                  evidence_image_url: undefined,
                  original_image_url: undefined
                }
              ]
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as {
      report: {
        images: Array<{ id: number }>;
        issues: Array<{ id: number; title: string }>;
      };
    };
    const imageId = detailJson.report.images[0].id;
    const issue = detailJson.report.issues[0];

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          selected_issues_json: JSON.stringify([{ id: issue.id, title: issue.title }]),
          should_corrected: "2026-04-08",
          result_semantic_state: "issue_found"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 400);
    const reviewJson = (await reviewResp.json()) as { error: string; success: boolean };
    assert.equal(reviewJson.success, false);
    assert.match(reviewJson.error, /缺少可下发图片/);
    assert.equal(fetchCalls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("review submit treats huiyunying business failure as 502", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/sign")) {
      return new Response("token-123", {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    }
    if (url.includes("/route/ri/open/item/create")) {
      return new Response(JSON.stringify({ status: -20000, message: "链接不是一个有效的图片类型的链接!" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-business-fail",
          published_at: "2026-03-26 10:00:00",
          report: {
            ...publishPayload.report,
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-03-26",
              end_date: "2026-03-26",
              generated_at: "2026-03-26 10:00:00"
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as {
      report: {
        images: Array<{ id: number }>;
        issues: Array<{ id: number; title: string }>;
      };
    };
    const imageId = detailJson.report.images[0].id;
    const issue = detailJson.report.issues[0];

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          selected_issues_json: JSON.stringify([{ id: issue.id, title: issue.title }]),
          should_corrected: "2026-04-05"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 502);
    const reviewJson = (await reviewResp.json()) as { success: boolean; detail: string };
    assert.equal(reviewJson.success, false);
    assert.match(reviewJson.detail, /链接不是一个有效的图片类型的链接/);
    assert.equal(rectificationModule.createRectificationService().listByResultId(imageId).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inconclusive result completes locally without creating rectification order", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<string> = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-inconclusive-local-only",
          published_at: "2026-03-27 10:00:00",
          report: {
            ...publishPayload.report,
            summary: {
              metrics: {
                store_count: 1,
                image_count: 1,
                issue_count: 0
              }
            },
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-03-27",
              end_date: "2026-03-27",
              generated_at: "2026-03-27 10:00:00"
            },
            facts: {
              ...publishPayload.report.facts,
              captures: [
                {
                  ...publishPayload.report.facts.captures[0],
                  issue_count: 0
                }
              ],
              inspections: [
                {
                  ...publishPayload.report.facts.inspections[0],
                  total_issues: 0,
                  raw_result: "巡检目标缺失，无法进行合规性检查。"
                }
              ],
              issues: []
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as { report: { images: Array<{ id: number; review_state: string }> } };
    const imageId = detailJson.report.images[0].id;
    assert.equal(detailJson.report.images[0].review_state, "pending");

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          note: "人工确认：目标缺失，本次仅本地复核。",
          result_semantic_state: "inconclusive"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 200);
    const reviewJson = (await reviewResp.json()) as {
      success: boolean;
      result_semantic_state: string | null;
      rectification_orders: Array<unknown>;
      should_corrected: string | null;
      to_status: string;
    };
    assert.equal(reviewJson.success, true);
    assert.equal(reviewJson.result_semantic_state, "inconclusive");
    assert.equal(reviewJson.to_status, "completed");
    assert.equal(reviewJson.should_corrected, null);
    assert.equal(reviewJson.rectification_orders.length, 0);
    assert.equal(fetchCalls.length, 0);
    assert.equal(rectificationModule.createRectificationService().listByResultId(imageId).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inspection failed result also completes locally without creating rectification order", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<string> = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const publishResp = await publishRoute.POST(
      new Request("http://127.0.0.1:3000/api/reports/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...publishPayload,
          idempotency_key: "review-test-inspection-failed-local-only",
          published_at: "2026-03-28 10:00:00",
          report: {
            ...publishPayload.report,
            summary: {
              metrics: {
                store_count: 1,
                image_count: 1,
                issue_count: 0
              }
            },
            report_meta: {
              ...publishPayload.report.report_meta,
              start_date: "2026-03-28",
              end_date: "2026-03-28",
              generated_at: "2026-03-28 10:00:00"
            },
            facts: {
              ...publishPayload.report.facts,
              captures: [
                {
                  ...publishPayload.report.facts.captures[0],
                  issue_count: 0
                }
              ],
              inspections: [
                {
                  ...publishPayload.report.facts.inspections[0],
                  status: "failed",
                  total_issues: 0,
                  raw_result: "模型执行失败",
                  error_message: "model timeout"
                }
              ],
              issues: []
            }
          }
        })
      })
    );
    const publishJson = (await publishResp.json()) as { report_id: number };
    const reportId = publishJson.report_id;

    const detailResp = await reportRoute.GET(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}`, { headers: { cookie: sessionCookie } }),
      { params: Promise.resolve({ reportId: String(reportId) }) }
    );
    const detailJson = (await detailResp.json()) as { report: { images: Array<{ id: number; review_state: string }> } };
    const imageId = detailJson.report.images[0].id;
    assert.equal(detailJson.report.images[0].review_state, "pending");

    const reviewResp = await reviewRoute.POST(
      new Request(`http://127.0.0.1:3000/api/reports/${reportId}/images/${imageId}/review-status`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({
          review_status: "completed",
          note: "人工确认：巡检失败，本次仅本地复核。",
          result_semantic_state: "inspection_failed"
        })
      }),
      {
        params: Promise.resolve({ reportId: String(reportId), imageId: String(imageId) })
      }
    );

    assert.equal(reviewResp.status, 200);
    const reviewJson = (await reviewResp.json()) as {
      success: boolean;
      result_semantic_state: string | null;
      rectification_orders: Array<unknown>;
      should_corrected: string | null;
      to_status: string;
    };
    assert.equal(reviewJson.success, true);
    assert.equal(reviewJson.result_semantic_state, "inspection_failed");
    assert.equal(reviewJson.to_status, "completed");
    assert.equal(reviewJson.should_corrected, null);
    assert.equal(reviewJson.rectification_orders.length, 0);
    assert.equal(fetchCalls.length, 0);
    assert.equal(rectificationModule.createRectificationService().listByResultId(imageId).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("roles save route updates viewer/reviewer permissions for admin", async () => {
  const auth = authService.createAuthService();
  const matrixBefore = auth.listRolePermissionMatrix();
  const viewerBefore = matrixBefore.find((item) => item.roleCode === "viewer")?.permissionCodes || [];
  const reviewerBefore = matrixBefore.find((item) => item.roleCode === "reviewer")?.permissionCodes || [];

  try {
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
    const sessionCookie = loginResp.headers.get("set-cookie") || "";

    const formData = new FormData();
    formData.append("permissions_viewer", "report:read");
    formData.append("permissions_viewer", "rectification:read");
    formData.append("permissions_viewer", "system:settings:write");
    formData.append("permissions_reviewer", "report:read");
    formData.append("permissions_reviewer", "review:write");
    formData.append("permissions_reviewer", "analytics:read");
    formData.append("permissions_reviewer", "role:write");

    const saveResp = await rolesSaveRoute.POST(
      new Request("http://127.0.0.1:3000/admin/roles/save", {
        method: "POST",
        headers: { cookie: sessionCookie },
        body: formData
      })
    );

    assert.equal(saveResp.status, 303);
    assert.equal(saveResp.headers.get("location"), "http://127.0.0.1:3000/admin/roles?saved=1");

    const matrixAfter = auth.listRolePermissionMatrix();
    const viewerAfter = matrixAfter.find((item) => item.roleCode === "viewer")?.permissionCodes || [];
    const reviewerAfter = matrixAfter.find((item) => item.roleCode === "reviewer")?.permissionCodes || [];

    assert.deepEqual(viewerAfter, ["report:read", "rectification:read"]);
    assert.deepEqual(reviewerAfter, ["report:read", "review:write", "analytics:read", "role:write"]);
  } finally {
    auth.replaceRolePermissions("viewer", viewerBefore);
    auth.replaceRolePermissions("reviewer", reviewerBefore);
  }
});

test("roles save route rejects non-admin role write", async () => {
  const auth = authService.createAuthService();
  const username = `viewer_scope_${Date.now()}`;
  auth.createUser({
    username,
    displayName: "仅查看用户",
    password: "ViewerPass123!Aa",
    roleCode: "viewer",
    enterpriseScopeIds: [],
    organizationScopeIds: [],
    storeScopeIds: []
  });

  const loginResp = await loginRoute.POST(
    new Request("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      body: (() => {
        const formData = new FormData();
        formData.set("username", username);
        formData.set("password", "ViewerPass123!Aa");
        return formData;
      })()
    })
  );
  const sessionCookie = loginResp.headers.get("set-cookie") || "";
  assert.ok(sessionCookie.includes("report_system_session="));

  const formData = new FormData();
  formData.append("permissions_viewer", "report:read");

  const saveResp = await rolesSaveRoute.POST(
    new Request("http://127.0.0.1:3000/admin/roles/save", {
      method: "POST",
      headers: { cookie: sessionCookie },
      body: formData
    })
  );
  assert.equal(saveResp.status, 403);
});

test("service rejects creating user with admin role", () => {
  const auth = authService.createAuthService();
  assert.throws(
    () =>
      auth.createUser({
        username: `admin_like_${Date.now()}`,
        displayName: "非法管理员",
        password: "StrongPass1234!Aa",
        roleCode: "admin",
        enterpriseScopeIds: [],
        organizationScopeIds: [],
        storeScopeIds: []
      }),
    /Admin role is reserved/
  );
});

test("service rejects assigning admin role to non-bootstrap user", () => {
  const auth = authService.createAuthService();
  const created = auth.createUser({
    username: `manage_case_${Date.now()}`,
    displayName: "业务管理员用户",
    password: "StrongPass1234!Aa",
    roleCode: "manage",
    enterpriseScopeIds: [],
    organizationScopeIds: [],
    storeScopeIds: []
  });

  assert.throws(() => auth.updateUserRole(created.id, "admin"), /Admin role is reserved/);
});

test("service profile update is atomic when password policy validation fails", () => {
  const auth = authService.createAuthService();
  const systemSettingsService = systemSettingsModule.createSystemSettingsService();
  const previousPolicy = systemSettingsService.getAuthSecurityPolicy();
  systemSettingsService.saveAuthSecurityPolicy({
    ...previousPolicy,
    passwordMinLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialCharacter: true
  });

  try {
    const created = auth.createUser({
      username: `atomic_case_${Date.now()}`,
      displayName: "原子更新测试用户",
      password: "AtomicPass1234!Aa",
      roleCode: "manage",
      enterpriseScopeIds: [],
      organizationScopeIds: [],
      storeScopeIds: []
    });
    const before = auth.listUsers().find((item) => item.id === created.id);
    assert.ok(before);
    assert.equal(before?.status, "active");

    assert.throws(
      () =>
        auth.updateUserProfile({
          userId: created.id,
          status: "disabled",
          password: "short"
        }),
      /密码|password|Password|至少|minimum/
    );

    const after = auth.listUsers().find((item) => item.id === created.id);
    assert.ok(after);
    assert.equal(after?.status, "active");
  } finally {
    systemSettingsService.saveAuthSecurityPolicy(previousPolicy);
  }
});

test("login applies lock policy after max failures", async () => {
  const systemSettingsService = systemSettingsModule.createSystemSettingsService();
  const previousPolicy = systemSettingsService.getAuthSecurityPolicy();
  systemSettingsService.saveAuthSecurityPolicy({
    ...previousPolicy,
    loginMaxFailures: 2,
    loginLockDurationMs: 600000
  });

  try {
    function readLoginError(location: string): string {
      const url = new URL(location, "http://127.0.0.1:3000");
      const errorParam = url.searchParams.get("error") || "";
      return decodeURIComponent(errorParam);
    }

    const firstWrongResp = await loginRoute.POST(
      new Request("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("username", "admin");
          formData.set("password", "wrong-password-1");
          return formData;
        })()
      })
    );
    assert.equal(firstWrongResp.status, 303);
    const firstWrongLocation = firstWrongResp.headers.get("location") || "";
    assert.ok(firstWrongLocation.includes("/login?"));
    assert.ok(readLoginError(firstWrongLocation).includes("账号或密码错误"));

    const secondWrongResp = await loginRoute.POST(
      new Request("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("username", "admin");
          formData.set("password", "wrong-password-2");
          return formData;
        })()
      })
    );
    assert.equal(secondWrongResp.status, 303);
    const secondWrongLocation = secondWrongResp.headers.get("location") || "";
    assert.ok(readLoginError(secondWrongLocation).includes("账号已锁定"));

    const validPasswordWhileLockedResp = await loginRoute.POST(
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
    assert.equal(validPasswordWhileLockedResp.status, 303);
    const lockedLocation = validPasswordWhileLockedResp.headers.get("location") || "";
    assert.ok(readLoginError(lockedLocation).includes("账号已锁定"));
  } finally {
    systemSettingsService.saveAuthSecurityPolicy(previousPolicy);
  }
});

test("password policy is enforced for create and reset password", () => {
  const systemSettingsService = systemSettingsModule.createSystemSettingsService();
  const previousPolicy = systemSettingsService.getAuthSecurityPolicy();
  systemSettingsService.saveAuthSecurityPolicy({
    ...previousPolicy,
    passwordMinLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialCharacter: true
  });

  const auth = authService.createAuthService();
  try {
    assert.throws(
      () =>
        auth.createUser({
          username: "policy-user-weak",
          displayName: "策略用户弱密码",
          password: "12345678",
          roleCode: "viewer",
          enterpriseScopeIds: [],
          organizationScopeIds: [],
          storeScopeIds: []
        }),
      /密码不符合安全策略/
    );

    const createdUser = auth.createUser({
      username: "policy-user-strong",
      displayName: "策略用户强密码",
      password: "StrongPass1234!Aa",
      roleCode: "viewer",
      enterpriseScopeIds: [],
      organizationScopeIds: [],
      storeScopeIds: []
    });
    assert.ok(createdUser.id > 0);

    assert.throws(() => auth.updateUserPassword(createdUser.id, "weak"), /密码不符合安全策略/);
  } finally {
    systemSettingsService.saveAuthSecurityPolicy(previousPolicy);
  }
});
