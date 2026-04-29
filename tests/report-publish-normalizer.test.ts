import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePublishedReport } from "../backend/report/report-publish-normalizer";
import { reportPublishSchema } from "../backend/report/report.schema";
import type { ReportPublishPayload } from "../backend/report/report.types";

function createPayload(): ReportPublishPayload {
  return {
    source_system: "vision-agent",
    payload_version: 2,
    idempotency_key: "publish-auto-review-demo",
    published_at: "2026-04-01 12:00:00",
    report: {
      report_meta: {
        report_type: "daily",
        topic: "智能巡检",
        plan_id: "plan-demo",
        plan_name: "演示计划",
        report_versions: ["v1"],
        enterprise_id: "ent-demo",
        enterprise_name: "演示企业",
        start_date: "2026-04-01",
        end_date: "2026-04-01",
        operator: "tester",
        generated_at: "2026-04-01 12:00:00"
      },
      summary: {
        metrics: {}
      },
      facts: {
        stores: [
          {
            store_id: "store-1",
            store_code: "S001",
            store_name: "测试门店",
            organize_name: "总部"
          }
        ],
        cameras: [],
        captures: [
          {
            capture_id: "capture-1",
            image_id: "image-1",
            store_id: "store-1",
            store_name: "测试门店",
            preview_url: "https://example.com/1.jpg",
            captured_at: "2026-04-01 10:00:00",
            issue_count: 0
          },
          {
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            store_name: "测试门店",
            preview_url: "https://example.com/2.jpg",
            captured_at: "2026-04-01 10:05:00",
            issue_count: 1
          }
        ],
        inspections: [
          {
            inspection_id: "inspection-1",
            capture_id: "capture-1",
            image_id: "image-1",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            status: "success",
            raw_result: "识别完成，未发现异常。",
            total_issues: 0
          },
          {
            inspection_id: "inspection-2",
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            status: "success",
            raw_result: "发现货架未摆满。",
            total_issues: 1
          }
        ],
        issues: [
          {
            issue_id: "issue-1",
            inspection_id: "inspection-2",
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            issue_type: "陈列",
            description: "货架未摆满",
            count: 1,
            severity: "P2",
            review_status: "pending_review"
          }
        ]
      }
    }
  };
}

test("未发现问题的图片在入库标准化时自动标记为已复核", () => {
  const normalized = normalizePublishedReport(createPayload());

  assert.equal(normalized.images.length, 2);
  assert.equal(normalized.images[0].review_state, "completed");
  assert.equal(normalized.images[0].reviewed_at, "2026-04-01 12:00:00");
  assert.deepEqual(normalized.images[0].review_payload, {
    auto_completed: true,
    auto_completed_reason: "pass_no_issues"
  });
  assert.equal(normalized.images[1].review_state, "pending");

  assert.equal(normalized.completed_result_count, 1);
  assert.equal(normalized.pending_result_count, 1);
  assert.equal(normalized.progress_state, "in_progress");
  assert.equal(normalized.stores[0].completed_result_count, 1);
  assert.equal(normalized.stores[0].progress_state, "in_progress");
});

test("发布 schema 保留 V5 evidence 扩展字段并拒绝重复业务 ID", () => {
  const payload = createPayload();
  payload.report.facts.inspections[0].evidence_image_url = "https://oss.example.com/evidence-a.jpg?token=keep";
  payload.report.facts.inspections[0].evidence_image_source = "oss_rendered";
  payload.report.facts.inspections[0].original_image_url = "https://hyy.example.com/original-a.jpg";
  payload.report.facts.inspections[0].provider_meta = {
    unstable_evidence: true,
    evidence_asset_override_reason: "人工覆盖发布"
  };
  payload.report.facts.inspections[0].raw_result_json = { labels: [{ x: 1, y: 2 }] };
  payload.report.facts.issues[0].evidence_image_url = "https://oss.example.com/issue-a.jpg";
  payload.report.facts.issues[0].evidence_image_source = "oss_rendered";
  payload.report.facts.issues[0].original_image_url = "https://hyy.example.com/issue-original.jpg";

  const parsed = reportPublishSchema.safeParse(payload);

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }
  assert.equal(parsed.data.report.facts.inspections[0].evidence_image_url, "https://oss.example.com/evidence-a.jpg?token=keep");
  assert.deepEqual(parsed.data.report.facts.inspections[0].provider_meta, {
    unstable_evidence: true,
    evidence_asset_override_reason: "人工覆盖发布"
  });
  assert.deepEqual(parsed.data.report.facts.inspections[0].raw_result_json, { labels: [{ x: 1, y: 2 }] });
  assert.equal(parsed.data.report.facts.issues[0].evidence_image_url, "https://oss.example.com/issue-a.jpg");

  const duplicatePayload = createPayload();
  duplicatePayload.report.facts.inspections[1].inspection_id = duplicatePayload.report.facts.inspections[0].inspection_id;

  const duplicateParsed = reportPublishSchema.safeParse(duplicatePayload);

  assert.equal(duplicateParsed.success, false);

  const duplicateCapturePayload = createPayload();
  duplicateCapturePayload.report.facts.captures[1].capture_id = duplicateCapturePayload.report.facts.captures[0].capture_id;

  const duplicateCaptureParsed = reportPublishSchema.safeParse(duplicateCapturePayload);

  assert.equal(duplicateCaptureParsed.success, false);

  const duplicateIssuePayload = createPayload();
  duplicateIssuePayload.report.facts.issues.push({
    ...duplicateIssuePayload.report.facts.issues[0],
    inspection_id: "inspection-1"
  });

  const duplicateIssueParsed = reportPublishSchema.safeParse(duplicateIssuePayload);

  assert.equal(duplicateIssueParsed.success, false);
});

test("同一抓拍下多技能各自保留标注图，issue 优先使用关联 inspection evidence", () => {
  const payload = createPayload();
  payload.report.facts.captures = [
    {
      capture_id: "capture-shared",
      image_id: "image-shared",
      store_id: "store-1",
      store_name: "测试门店",
      preview_url: "https://example.com/original-shared.jpg",
      captured_at: "2026-04-01 10:00:00",
      issue_count: 1
    }
  ];
  payload.report.facts.inspections = [
    {
      inspection_id: "inspection-a",
      capture_id: "capture-shared",
      image_id: "image-shared",
      store_id: "store-1",
      skill_id: "skill-a",
      skill_name: "技能 A",
      status: "success",
      raw_result: "A",
      evidence_image_url: "https://oss.example.com/a.jpg?token=a",
      evidence_image_source: "oss_rendered",
      original_image_url: "https://example.com/original-shared.jpg",
      provider_meta: {
        unstable_evidence: false
      },
      total_issues: 0
    },
    {
      inspection_id: "inspection-b",
      capture_id: "capture-shared",
      image_id: "image-shared",
      store_id: "store-1",
      skill_id: "skill-b",
      skill_name: "技能 B",
      status: "success",
      raw_result: "B",
      evidence_image_url: "https://oss.example.com/b.jpg?token=b",
      evidence_image_source: "oss_rendered",
      original_image_url: "https://example.com/original-shared.jpg",
      provider_meta: {
        unstable_evidence: true,
        evidence_asset_override_reason: "人工覆盖发布"
      },
      total_issues: 1
    }
  ];
  payload.report.facts.issues = [
    {
      issue_id: "issue-b",
      inspection_id: "inspection-b",
      capture_id: "capture-shared",
      image_id: "image-shared",
      store_id: "store-1",
      skill_id: "skill-b",
      skill_name: "技能 B",
      issue_type: "陈列",
      description: "技能 B 识别问题",
      count: 1,
      severity: "P2",
      review_status: "pending_review",
      extra_json: {
        unstable_evidence: true,
        evidence_asset_override_reason: "人工覆盖发布"
      }
    }
  ];

  const normalized = normalizePublishedReport(payload);
  const inspectionA = normalized.inspections.find((inspection) => inspection.inspection_id === "inspection-a");
  const inspectionB = normalized.inspections.find((inspection) => inspection.inspection_id === "inspection-b");
  const issueB = normalized.issues[0];

  assert.equal((inspectionA?.metadata as Record<string, unknown>).evidence_image_url, "https://oss.example.com/a.jpg?token=a");
  assert.equal((inspectionB?.metadata as Record<string, unknown>).evidence_image_url, "https://oss.example.com/b.jpg?token=b");
  assert.equal(issueB.image_url, "https://oss.example.com/b.jpg?token=b");
  assert.equal((issueB.metadata as Record<string, unknown>).linked_inspection_evidence_image_url, "https://oss.example.com/b.jpg?token=b");
  assert.equal((issueB.metadata as Record<string, unknown>).evidence_image_url, "");
  assert.equal((issueB.metadata as Record<string, unknown>).display_image_url, "https://oss.example.com/b.jpg?token=b");
});

test("issue 缺失 inspection_id 时按 capture_id 和 skill_id 降级匹配 inspection", () => {
  const payload = createPayload();
  payload.report.facts.captures = [
    {
      capture_id: "capture-shared-fallback",
      image_id: "image-shared-fallback",
      store_id: "store-1",
      store_name: "测试门店",
      preview_url: "https://example.com/original-fallback.jpg",
      captured_at: "2026-04-01 10:00:00",
      issue_count: 1
    }
  ];
  payload.report.facts.inspections = [
    {
      inspection_id: "inspection-fallback-a",
      capture_id: "capture-shared-fallback",
      image_id: "image-shared-fallback",
      store_id: "store-1",
      skill_id: "skill-a",
      skill_name: "技能 A",
      status: "success",
      evidence_image_url: "https://oss.example.com/fallback-a.jpg",
      total_issues: 1
    }
  ];
  payload.report.facts.issues = [
    {
      issue_id: "issue-without-inspection",
      capture_id: "capture-shared-fallback",
      image_id: "image-shared-fallback",
      store_id: "store-1",
      skill_id: "skill-a",
      skill_name: "技能 A",
      issue_type: "陈列",
      description: "未绑定 inspection_id 的问题",
      count: 1,
      severity: "P2"
    }
  ];

  const parsed = reportPublishSchema.safeParse(payload);
  assert.equal(parsed.success, true);

  const normalized = normalizePublishedReport(payload);
  const issue = normalized.issues[0];

  assert.equal(issue.image_url, "https://oss.example.com/fallback-a.jpg");
  assert.equal((issue.metadata as Record<string, unknown>).linked_inspection_id, "inspection-fallback-a");
  assert.equal((issue.metadata as Record<string, unknown>).missing_inspection, false);
});
