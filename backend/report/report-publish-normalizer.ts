import { createHash } from "node:crypto";

import type { JsonValue } from "@/backend/shared/json";
import type {
  ProgressState,
  ReportCaptureFact,
  ReportInspectionFact,
  ReportIssueFact,
  ReportPublishPayload,
  ResultReviewState,
  ReviewProgressSummary
} from "@/backend/report/report.types";
import { classifyReportResultSemantics } from "@/backend/report/result-semantics";

interface NormalizedStoreRecord extends ReviewProgressSummary {
  store_id: string;
  store_name: string;
  organization_name: string;
  issue_count: number;
  image_count: number;
  metadata: JsonValue;
  state_snapshot: JsonValue;
  display_order: number;
}

interface NormalizedImageRecord {
  store_id: string | null;
  store_name: string | null;
  object_key: string | null;
  bucket: string | null;
  region: string | null;
  url: string;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  review_state: ResultReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  review_payload: JsonValue;
  metadata: JsonValue;
  display_order: number;
}

interface NormalizedIssueRecord {
  store_id: string | null;
  store_name: string | null;
  title: string;
  category: string | null;
  severity: string | null;
  description: string | null;
  suggestion: string | null;
  image_url: string | null;
  image_object_key: string | null;
  review_state: ResultReviewState;
  metadata: JsonValue;
  display_order: number;
}

interface NormalizedInspectionRecord {
  store_id: string | null;
  store_name: string | null;
  inspection_id: string;
  skill_id: string;
  skill_name: string | null;
  status: string | null;
  raw_result: string | null;
  error_message: string | null;
  metadata: JsonValue;
  display_order: number;
}

interface CaptureSemanticSnapshot {
  semanticState: "issue_found" | "pass" | "inconclusive" | "inspection_failed";
  reviewState: ResultReviewState;
}

export interface NormalizedPublishedReport extends ReviewProgressSummary {
  publishId: string;
  sourceSystem: string;
  payloadVersion: number;
  payloadHash: string;
  sourceEnterpriseId: string;
  enterpriseName: string;
  reportType: string;
  reportVersion: string;
  periodStart: string;
  periodEnd: string;
  operatorName: string;
  storeCount: number;
  imageCount: number;
  issueCount: number;
  completedStoreCount: number;
  pendingStoreCount: number;
  inProgressStoreCount: number;
  summaryMetrics: Record<string, JsonValue>;
  stateSnapshot: JsonValue;
  extensions: JsonValue;
  rawPayload: ReportPublishPayload;
  publishedAt: string;
  stores: NormalizedStoreRecord[];
  images: NormalizedImageRecord[];
  issues: NormalizedIssueRecord[];
  inspections: NormalizedInspectionRecord[];
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeIncomingReviewState(value: unknown): ResultReviewState {
  return value === "completed" || value === "reviewed" ? "completed" : "pending";
}

function readReportType(payload: ReportPublishPayload): string {
  const meta = payload.report.report_meta;
  return safeString(meta.report_type) || "daily";
}

function buildReportVersion(payload: ReportPublishPayload): string {
  const meta = payload.report.report_meta;
  const reportType = readReportType(payload);
  const planId = safeString(meta.plan_id) || "all-plans";
  const topic = safeString(meta.topic) || "untitled";
  const versionText = meta.report_versions.join("+") || "default";
  return `${meta.start_date}~${meta.end_date}|${reportType}|${planId}|${topic}|${versionText}`;
}

const IMAGE_URL_PATTERN = /^(.+?\.(?:jpg|jpeg|png|webp|bmp|gif|avif|heic|heif))(?:$|\/)/i;

function normalizeDisplayImageUrl(value: unknown): string {
  const rawUrl = safeString(value);
  if (!rawUrl) {
    return "";
  }

  const withoutHash = rawUrl.split("#", 1)[0] ?? "";
  const withoutQuery = withoutHash.split("?", 1)[0] ?? "";
  const matched = withoutQuery.match(IMAGE_URL_PATTERN);
  if (matched?.[1]) {
    return matched[1];
  }
  return withoutQuery;
}

function resolveDisplayUrl(capture: ReportCaptureFact | undefined): string {
  const previewUrl = normalizeDisplayImageUrl(capture?.preview_url);
  if (previewUrl) {
    return previewUrl;
  }
  const captureUrl = normalizeDisplayImageUrl(capture?.capture_url);
  if (captureUrl) {
    return captureUrl;
  }
  return "about:blank";
}

function buildProgressSummary(total: number, completed: number): ReviewProgressSummary {
  const normalizedTotal = Math.max(0, total);
  const normalizedCompleted = Math.max(0, Math.min(completed, normalizedTotal));
  const pending = Math.max(0, normalizedTotal - normalizedCompleted);
  let progressState: ProgressState = "pending";

  if (normalizedTotal > 0 && normalizedCompleted >= normalizedTotal) {
    progressState = "completed";
  } else if (normalizedCompleted > 0) {
    progressState = "in_progress";
  }

  return {
    progress_state: progressState,
    total_result_count: normalizedTotal,
    completed_result_count: normalizedCompleted,
    pending_result_count: pending,
    progress_percent: normalizedTotal > 0 ? Math.round((normalizedCompleted / normalizedTotal) * 100) : 0
  };
}

export function normalizePublishedReport(payload: ReportPublishPayload): NormalizedPublishedReport {
  const meta = payload.report.report_meta;
  const summaryMetrics = (payload.report.summary.metrics ?? {}) as Record<string, JsonValue>;
  const facts = payload.report.facts;
  const capturesById = new Map<string, ReportCaptureFact>();
  const inspectionsByCaptureId = new Map<string, ReportInspectionFact[]>();
  const issuesByCaptureId = new Map<string, ReportIssueFact[]>();

  facts.captures.forEach((capture) => {
    capturesById.set(capture.capture_id, capture);
  });

  facts.inspections.forEach((inspection) => {
    const list = inspectionsByCaptureId.get(inspection.capture_id) ?? [];
    list.push(inspection);
    inspectionsByCaptureId.set(inspection.capture_id, list);
  });

  facts.issues.forEach((issue) => {
    const list = issuesByCaptureId.get(issue.capture_id) ?? [];
    list.push(issue);
    issuesByCaptureId.set(issue.capture_id, list);
  });

  const captureSemanticMap = new Map<string, CaptureSemanticSnapshot>();
  facts.captures.forEach((capture) => {
    const semanticState = classifyReportResultSemantics(
      (issuesByCaptureId.get(capture.capture_id) ?? []).map((issue) => ({ id: issue.issue_id })),
      (inspectionsByCaptureId.get(capture.capture_id) ?? []).map((inspection) => ({
        status: inspection.status ?? null,
        raw_result: inspection.raw_result ?? null,
        error_message: inspection.error_message ?? null
      }))
    );
    captureSemanticMap.set(capture.capture_id, {
      semanticState,
      reviewState: semanticState === "pass" ? "completed" : "pending"
    });
  });

  const storeMap = new Map<string, Omit<NormalizedStoreRecord, keyof ReviewProgressSummary | "state_snapshot">>();

  facts.stores.forEach((store, index) => {
    storeMap.set(store.store_id, {
      store_id: store.store_id,
      store_name: store.store_name,
      organization_name: safeString(store.organize_name),
      issue_count: 0,
      image_count: 0,
      metadata: {
        store_code: safeString(store.store_code),
        organize_code: safeString(store.organize_code),
        store_type: safeString(store.store_type),
        franchisee_name: safeString(store.franchisee_name),
        supervisor: safeString(store.supervisor),
        enterprise_id: safeString(store.enterprise_id) || meta.enterprise_id,
        enterprise_name: safeString(store.enterprise_name) || meta.enterprise_name
      },
      display_order: index
    });
  });

  facts.captures.forEach((capture) => {
    if (!storeMap.has(capture.store_id)) {
      storeMap.set(capture.store_id, {
        store_id: capture.store_id,
        store_name: safeString(capture.store_name) || capture.store_id,
        organization_name: "",
        issue_count: 0,
        image_count: 0,
        metadata: {
          store_code: safeString(capture.store_code),
          organize_code: "",
          enterprise_id: meta.enterprise_id,
          enterprise_name: meta.enterprise_name
        },
        display_order: storeMap.size
      });
    }
    const store = storeMap.get(capture.store_id);
    if (store) {
      store.image_count += 1;
    }
  });

  facts.issues.forEach((issue) => {
    if (!storeMap.has(issue.store_id)) {
      storeMap.set(issue.store_id, {
        store_id: issue.store_id,
        store_name: safeString(issue.store_name) || issue.store_id,
        organization_name: "",
        issue_count: 0,
        image_count: 0,
        metadata: {
          store_code: safeString(issue.store_code),
          organize_code: "",
          enterprise_id: meta.enterprise_id,
          enterprise_name: meta.enterprise_name
        },
        display_order: storeMap.size
      });
    }
    const store = storeMap.get(issue.store_id);
    if (store) {
      store.issue_count += Math.max(1, safeNumber(issue.count));
    }
  });

  const completedCaptureCountByStoreId = new Map<string, number>();
  facts.captures.forEach((capture) => {
    if ((captureSemanticMap.get(capture.capture_id)?.reviewState ?? "pending") !== "completed") {
      return;
    }
    completedCaptureCountByStoreId.set(
      capture.store_id,
      (completedCaptureCountByStoreId.get(capture.store_id) ?? 0) + 1
    );
  });

  const stores = Array.from(storeMap.values())
    .sort((left, right) => left.display_order - right.display_order)
    .map((store) => {
      const progress = buildProgressSummary(store.image_count, completedCaptureCountByStoreId.get(store.store_id) ?? 0);
      return {
        ...store,
        ...progress,
        state_snapshot: {
          level: "store",
          result_progress: progress,
          issue_count: store.issue_count
        } as unknown as JsonValue
      };
    });

  const images: NormalizedImageRecord[] = facts.captures.map((capture, index) => {
    const semanticSnapshot = captureSemanticMap.get(capture.capture_id) ?? {
      semanticState: "inconclusive" as const,
      reviewState: "pending" as const
    };
    const reviewPayload: JsonValue =
      semanticSnapshot.reviewState === "completed"
        ? {
            auto_completed: true,
            auto_completed_reason: "pass_no_issues"
          }
        : {};
    return {
      store_id: capture.store_id || null,
      store_name: capture.store_name || null,
      object_key: safeString(capture.oss_key) || safeString(capture.capture_url) || null,
      bucket: null,
      region: null,
      url: resolveDisplayUrl(capture),
      width: null,
      height: null,
      captured_at: safeString(capture.captured_at) || null,
      review_state: semanticSnapshot.reviewState,
      reviewed_by: null,
      reviewed_at: semanticSnapshot.reviewState === "completed" ? payload.published_at : null,
      review_note: null,
      review_payload: reviewPayload,
      metadata: {
        capture_id: capture.capture_id,
        image_id: capture.image_id,
        camera_id: safeString(capture.camera_id),
        camera_index: capture.camera_index ?? null,
        camera_alias: safeString(capture.camera_alias),
        camera_device_code: safeString(capture.camera_device_code),
        capture_provider: safeString(capture.capture_provider),
        channel_code: safeString(capture.channel_code),
        capture_url: safeString(capture.capture_url),
        preview_url: safeString(capture.preview_url),
        display_url: resolveDisplayUrl(capture),
        oss_key: safeString(capture.oss_key),
        local_path: safeString(capture.local_path),
        issue_count: capture.issue_count ?? 0,
        result_semantic_state: semanticSnapshot.semanticState
      },
      display_order: index
    };
  });

  const inspections: NormalizedInspectionRecord[] = facts.inspections.map((inspection: ReportInspectionFact, index) => {
    const capture = capturesById.get(inspection.capture_id);
    return {
      store_id: inspection.store_id || null,
      store_name: inspection.store_name || null,
      inspection_id: inspection.inspection_id,
      skill_id: inspection.skill_id,
      skill_name: safeString(inspection.skill_name) || null,
      status: safeString(inspection.status) || null,
      raw_result: safeString(inspection.raw_result) || null,
      error_message: safeString(inspection.error_message) || null,
      metadata: {
        capture_id: inspection.capture_id,
        image_id: inspection.image_id,
        store_code: safeString(inspection.store_code),
        channel_code: safeString(inspection.channel_code),
        capture_provider: safeString(inspection.capture_provider),
        total_issues: inspection.total_issues ?? 0,
        capture_url: safeString(capture?.capture_url),
        preview_url: safeString(capture?.preview_url),
        oss_key: safeString(capture?.oss_key),
        display_url: resolveDisplayUrl(capture)
      },
      display_order: index
    };
  });

  const issues: NormalizedIssueRecord[] = facts.issues.map((issue: ReportIssueFact, index) => {
    const capture = capturesById.get(issue.capture_id);
    const imageUrl = resolveDisplayUrl(capture);
    const title = safeString(issue.description) || safeString(issue.issue_type) || safeString(issue.skill_name) || issue.issue_id;
    return {
      store_id: issue.store_id || null,
      store_name: issue.store_name || null,
      title,
      category: safeString(issue.issue_type) || null,
      severity: safeString(issue.severity) || null,
      description: safeString(issue.description) || null,
      suggestion: null,
      image_url: imageUrl !== "about:blank" ? imageUrl : null,
      image_object_key: safeString(capture?.oss_key) || safeString(capture?.capture_url) || null,
      review_state: normalizeIncomingReviewState(issue.review_status),
      metadata: {
        issue_id: issue.issue_id,
        inspection_id: issue.inspection_id,
        capture_id: issue.capture_id,
        image_id: issue.image_id,
        store_code: safeString(issue.store_code),
        skill_id: safeString(issue.skill_id),
        skill_name: safeString(issue.skill_name),
        count: issue.count ?? 0,
        extra_json: issue.extra_json ?? {},
        capture_url: safeString(capture?.capture_url),
        preview_url: safeString(capture?.preview_url),
        oss_key: safeString(capture?.oss_key),
        display_url: imageUrl
      },
      display_order: index
    };
  });

  const reportProgress = buildProgressSummary(
    images.length,
    images.filter((image) => image.review_state === "completed").length
  );
  const completedStoreCount = stores.filter((store) => store.progress_state === "completed").length;
  const inProgressStoreCount = stores.filter((store) => store.progress_state === "in_progress").length;
  const pendingStoreCount = stores.length - completedStoreCount - inProgressStoreCount;
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  return {
    publishId: payload.idempotency_key,
    sourceSystem: payload.source_system,
    payloadVersion: payload.payload_version,
    payloadHash,
    sourceEnterpriseId: meta.enterprise_id,
    enterpriseName: meta.enterprise_name,
    reportType: readReportType(payload),
    reportVersion: buildReportVersion(payload),
    periodStart: meta.start_date,
    periodEnd: meta.end_date,
    operatorName: meta.operator,
    storeCount: stores.length,
    imageCount: images.length,
    issueCount: issues.length,
    completedStoreCount,
    pendingStoreCount,
    inProgressStoreCount,
    ...reportProgress,
    summaryMetrics,
    stateSnapshot: {
      level: "report",
      result_progress: reportProgress,
      store_progress: {
        total_store_count: stores.length,
        completed_store_count: completedStoreCount,
        in_progress_store_count: inProgressStoreCount,
        pending_store_count: pendingStoreCount
      }
    } as unknown as JsonValue,
    extensions: {
      report_topic: safeString(meta.topic),
      plan_id: safeString(meta.plan_id),
      plan_name: safeString(meta.plan_name)
    },
    rawPayload: payload,
    publishedAt: payload.published_at,
    stores,
    images,
    issues,
    inspections
  };
}
