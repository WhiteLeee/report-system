import type {
  analyticsIssueFactTable,
  analyticsRectificationFactTable,
  analyticsResultFactTable,
  analyticsReviewFactTable
} from "@/backend/database/schema";
import { ANALYTICS_SCHEMA_VERSION } from "@/backend/analytics/contracts/analytics-version";
import { classifyReportResultSemantics } from "@/backend/report/result-semantics";
import { normalizeRemoteIfCorrected } from "@/backend/rectification/rectification-sync";

type AnalyticsResultFactInsert = typeof analyticsResultFactTable.$inferInsert;
type AnalyticsIssueFactInsert = typeof analyticsIssueFactTable.$inferInsert;
type AnalyticsReviewFactInsert = typeof analyticsReviewFactTable.$inferInsert;
type AnalyticsRectificationFactInsert = typeof analyticsRectificationFactTable.$inferInsert;

type SourceReportRow = {
  id: number;
  sourceEnterpriseId: string;
  enterpriseName: string;
  reportType: string;
  reportVersion: string;
  publishedAt: string;
  extensionsJson: string;
};

type SourceStoreRow = {
  reportId: number;
  storeId: string;
  storeName: string;
  organizationCode: string | null;
  organizationName: string | null;
  franchiseeName: string | null;
};

type SourceResultRow = {
  id: number;
  reportId: number;
  storeId: string | null;
  storeName: string | null;
  capturedAt: string | null;
  reviewState: string;
  reviewPayloadJson: string;
  metadataJson: string;
};

type SourceIssueRow = {
  id: number;
  title: string;
  category: string | null;
};

type SourceInspectionRow = {
  status: string | null;
  rawResult: string | null;
  errorMessage: string | null;
};

type SourceReviewLogRow = {
  id: number;
  reportId: number;
  resultId: number;
  storeId: string | null;
  storeName: string | null;
  fromStatus: string;
  toStatus: string;
  operatorName: string;
  note: string | null;
  metadataJson: string;
  createdAt: string;
};

type SourceRectificationOrderRow = {
  id: number;
  reportId: number;
  resultId: number;
  storeId: string | null;
  storeCode: string | null;
  storeName: string | null;
  huiYunYingOrderId: string | null;
  requestDescription: string;
  selectedIssuesJson: string;
  requestPayloadJson: string;
  responsePayloadJson: string;
  status: string;
  ifCorrected: string | null;
  shouldCorrected: string | null;
  realCorrectedTime: string | null;
  createdAt: string;
  updatedAt: string;
};

function safeParseRecord(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeParseArray(json: string): unknown[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: string | null | undefined): string {
  return String(value || "").slice(0, 10);
}

function computeMinutesDiff(start: string | null | undefined, end: string | null | undefined): number {
  const startTs = Date.parse(String(start || ""));
  const endTs = Date.parse(String(end || ""));
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) {
    return 0;
  }
  return Math.round((endTs - startTs) / 60000);
}

function inferReviewAction(fromStatus: string, toStatus: string): string {
  if (toStatus === "completed") {
    return "complete";
  }
  if (fromStatus === "completed" && toStatus !== "completed") {
    return "reopen";
  }
  return "transition";
}

function isAutoCompleted(reviewPayloadJson: string): boolean {
  const payload = safeParseRecord(reviewPayloadJson);
  return payload.auto_completed === true;
}

export function buildAnalyticsResultFact(input: {
  reportRow: SourceReportRow;
  resultRow: SourceResultRow;
  storeRow: SourceStoreRow | null;
  issueRows: SourceIssueRow[];
  inspectionRows: SourceInspectionRow[];
}): AnalyticsResultFactInsert {
  const extensions = safeParseRecord(input.reportRow.extensionsJson);
  const metadata = safeParseRecord(input.resultRow.metadataJson);
  const semanticState = classifyReportResultSemantics(
    input.issueRows,
    input.inspectionRows.map((inspection) => ({
      status: inspection.status,
      raw_result: inspection.rawResult,
      error_message: inspection.errorMessage
    }))
  );
  const autoCompleted = isAutoCompleted(input.resultRow.reviewPayloadJson);

  return {
    reportId: input.reportRow.id,
    resultId: input.resultRow.id,
    sourceEnterpriseId: input.reportRow.sourceEnterpriseId,
    enterpriseName: input.reportRow.enterpriseName,
    reportType: input.reportRow.reportType,
    reportTopic: readString(extensions, "report_topic"),
    planId: readString(extensions, "plan_id"),
    planName: readString(extensions, "plan_name"),
    reportVersion: input.reportRow.reportVersion,
    storeId: input.resultRow.storeId,
    storeName: input.resultRow.storeName || input.storeRow?.storeName || null,
    organizationCode: input.storeRow?.organizationCode || null,
    organizationName: input.storeRow?.organizationName || null,
    franchiseeName: input.storeRow?.franchiseeName || null,
    publishedDate: normalizeDate(input.reportRow.publishedAt),
    capturedDate: normalizeDate(input.resultRow.capturedAt) || normalizeDate(input.reportRow.publishedAt),
    resultSemanticState: semanticState,
    issueCount: input.issueRows.length,
    reviewState: input.resultRow.reviewState,
    autoCompleted: autoCompleted ? 1 : 0,
    rectificationRequired: semanticState === "issue_found" || input.issueRows.length > 0 ? 1 : 0,
    sourceSnapshotVersion: 1,
    analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
    sourcePayloadJson: JSON.stringify({
      result_metadata: metadata,
      issue_count: input.issueRows.length
    }),
    updatedAt: new Date().toISOString()
  };
}

export function buildAnalyticsIssueFact(input: {
  reportRow: SourceReportRow;
  issueRow: {
    id: number;
    reportId: number;
    resultId: number | null;
    storeId: string | null;
    storeName: string | null;
    title: string;
    category: string | null;
    severity: string | null;
    metadataJson: string;
  };
  storeRow: SourceStoreRow | null;
}): AnalyticsIssueFactInsert {
  const extensions = safeParseRecord(input.reportRow.extensionsJson);
  const metadata = safeParseRecord(input.issueRow.metadataJson);
  const issueType = input.issueRow.category || input.issueRow.title || "未分类问题";

  return {
    reportId: input.reportRow.id,
    resultId: input.issueRow.resultId,
    issueId: input.issueRow.id,
    sourceEnterpriseId: input.reportRow.sourceEnterpriseId,
    enterpriseName: input.reportRow.enterpriseName,
    reportType: input.reportRow.reportType,
    reportTopic: readString(extensions, "report_topic"),
    planId: readString(extensions, "plan_id"),
    planName: readString(extensions, "plan_name"),
    reportVersion: input.reportRow.reportVersion,
    storeId: input.issueRow.storeId,
    storeName: input.issueRow.storeName || input.storeRow?.storeName || null,
    organizationCode: input.storeRow?.organizationCode || null,
    organizationName: input.storeRow?.organizationName || null,
    franchiseeName: input.storeRow?.franchiseeName || null,
    publishedDate: normalizeDate(input.reportRow.publishedAt),
    skillId: readString(metadata, "skill_id"),
    skillName: readString(metadata, "skill_name"),
    issueType,
    severity: input.issueRow.severity,
    title: input.issueRow.title,
    analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
    sourcePayloadJson: JSON.stringify({
      issue_metadata: metadata
    }),
    updatedAt: new Date().toISOString()
  };
}

export function buildAnalyticsReviewFact(input: {
  reportRow: SourceReportRow;
  reviewLogRow: SourceReviewLogRow;
  storeRow: SourceStoreRow | null;
}): AnalyticsReviewFactInsert {
  const extensions = safeParseRecord(input.reportRow.extensionsJson);
  const metadata = safeParseRecord(input.reviewLogRow.metadataJson);
  const reviewDate = normalizeDate(input.reviewLogRow.createdAt);
  const fromStatus = String(input.reviewLogRow.fromStatus || "").trim();
  const toStatus = String(input.reviewLogRow.toStatus || "").trim();

  return {
    reportId: input.reportRow.id,
    resultId: input.reviewLogRow.resultId,
    reviewLogId: input.reviewLogRow.id,
    sourceEnterpriseId: input.reportRow.sourceEnterpriseId,
    enterpriseName: input.reportRow.enterpriseName,
    reportType: input.reportRow.reportType,
    reportTopic: readString(extensions, "report_topic"),
    planId: readString(extensions, "plan_id"),
    planName: readString(extensions, "plan_name"),
    reportVersion: input.reportRow.reportVersion,
    storeId: input.reviewLogRow.storeId,
    storeName: input.reviewLogRow.storeName || input.storeRow?.storeName || null,
    organizationCode: input.storeRow?.organizationCode || null,
    organizationName: input.storeRow?.organizationName || null,
    franchiseeName: input.storeRow?.franchiseeName || null,
    publishedDate: normalizeDate(input.reportRow.publishedAt),
    reviewDate,
    fromStatus,
    toStatus,
    operatorName: input.reviewLogRow.operatorName,
    reviewAction: inferReviewAction(fromStatus, toStatus),
    reviewLatencyMinutes: computeMinutesDiff(input.reportRow.publishedAt, input.reviewLogRow.createdAt),
    noteLength: String(input.reviewLogRow.note || "").trim().length,
    analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
    sourcePayloadJson: JSON.stringify({
      review_metadata: metadata
    }),
    updatedAt: new Date().toISOString()
  };
}

export function buildAnalyticsRectificationFact(input: {
  reportRow: SourceReportRow;
  rectificationRow: SourceRectificationOrderRow;
  storeRow: SourceStoreRow | null;
}): AnalyticsRectificationFactInsert {
  const extensions = safeParseRecord(input.reportRow.extensionsJson);
  const requestPayload = safeParseRecord(input.rectificationRow.requestPayloadJson);
  const responsePayload = safeParseRecord(input.rectificationRow.responsePayloadJson);
  const selectedIssues = safeParseArray(input.rectificationRow.selectedIssuesJson);
  const shouldCorrectedDate = normalizeDate(input.rectificationRow.shouldCorrected);
  const createdDate = normalizeDate(input.rectificationRow.createdAt);
  const completedDate = normalizeDate(input.rectificationRow.realCorrectedTime);
  const remoteIfCorrected = normalizeRemoteIfCorrected(input.rectificationRow.ifCorrected);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = remoteIfCorrected !== "1" && shouldCorrectedDate && shouldCorrectedDate < today;

  return {
    orderId: input.rectificationRow.id,
    reportId: input.reportRow.id,
    resultId: input.rectificationRow.resultId,
    sourceEnterpriseId: input.reportRow.sourceEnterpriseId,
    enterpriseName: input.reportRow.enterpriseName,
    reportType: input.reportRow.reportType,
    reportTopic: readString(extensions, "report_topic"),
    planId: readString(extensions, "plan_id"),
    planName: readString(extensions, "plan_name"),
    reportVersion: input.reportRow.reportVersion,
    storeId: input.rectificationRow.storeId,
    storeCode: input.rectificationRow.storeCode,
    storeName: input.rectificationRow.storeName || input.storeRow?.storeName || null,
    organizationCode: input.storeRow?.organizationCode || null,
    organizationName: input.storeRow?.organizationName || null,
    franchiseeName: input.storeRow?.franchiseeName || null,
    publishedDate: normalizeDate(input.reportRow.publishedAt),
    createdDate,
    shouldCorrectedDate: shouldCorrectedDate || null,
    completedDate: completedDate || null,
    localStatus: input.rectificationRow.status,
    remoteIfCorrected: remoteIfCorrected || null,
    syncFailed: input.rectificationRow.status === "sync_failed" ? 1 : 0,
    overdue: overdue ? 1 : 0,
    analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
    sourcePayloadJson: JSON.stringify({
      huiyunying_order_id: input.rectificationRow.huiYunYingOrderId,
      request_description: input.rectificationRow.requestDescription,
      selected_issue_count: selectedIssues.length,
      request_payload: requestPayload,
      response_payload: responsePayload
    }),
    updatedAt: new Date().toISOString()
  };
}
