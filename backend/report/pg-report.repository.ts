import { randomUUID } from "node:crypto";

import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  reportImageTable,
  reportInspectionTable,
  reportIssueTable,
  reportReviewLogTable,
  reportSourceSnapshotTable,
  reportStoreTable,
  reportTable
} from "@/backend/database/schema";
import { classifyReportResultSemantics } from "@/backend/report/result-semantics";
import { normalizePublishedReport } from "@/backend/report/report-publish-normalizer";
import type { ReportRepository } from "@/backend/report/report.repository";
import type {
  ProgressState,
  CreateManualReportIssueInput,
  PublishReceipt,
  PublishStatusReceipt,
  ReportDetail,
  ReportFilters,
  ReportImage,
  ReportInspection,
  ReportIssue,
  ReportPublishPayload,
  ReportResult,
  ReportReviewLog,
  ReportStore,
  ReportSummary,
  ResultReviewState,
  ReviewProgressSummary,
  ReviewSelectedIssue,
  ReviewResultUpdateResult,
  ReviewStatusUpdateInput,
  ReviewAction,
  ReviewDisposition
} from "@/backend/report/report.types";
import type { JsonValue } from "@/backend/shared/json";
import { canAccessEnterprise, normalizeScopeIds, resolveScopedStoreIds } from "@/backend/shared/request-scope";

function safeStringify(value: unknown, fallback: unknown = {}): any {
  return JSON.stringify(value ?? fallback);
}

function safeParse(json: string, fallback: JsonValue = {}): any {
  try {
    return JSON.parse(json) as JsonValue;
  } catch {
    return fallback;
  }
}

function readMetadataString(metadata: JsonValue, key: string): any {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = metadata[key as keyof typeof metadata];
  return typeof value === "string" ? value : "";
}

function buildProgressSummary(total: number, completed: number): any {
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

function normalizeResultReviewState(value: unknown): any {
  return value === "completed" || value === "reviewed" ? "completed" : "pending";
}

function toReportSummary(row: typeof reportTable.$inferSelect): any {
  const extensions = safeParse(row.extensionsJson, {}) as Record<string, JsonValue>;
  return {
    id: row.id,
    publish_id: row.publishId,
    source_system: row.sourceSystem,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
    report_topic: typeof extensions.report_topic === "string" ? extensions.report_topic : "",
    plan_id: typeof extensions.plan_id === "string" ? extensions.plan_id : "",
    plan_name: typeof extensions.plan_name === "string" ? extensions.plan_name : "",
    report_version: row.reportVersion,
    progress_state: row.progressState as ProgressState,
    period_start: row.periodStart,
    period_end: row.periodEnd,
    operator_name: row.operatorName,
    store_count: row.storeCount,
    image_count: row.imageCount,
    issue_count: row.issueCount,
    completed_store_count: row.completedStoreCount,
    pending_store_count: row.pendingStoreCount,
    in_progress_store_count: row.inProgressStoreCount,
    total_result_count: row.totalResultCount,
    completed_result_count: row.completedResultCount,
    pending_result_count: row.pendingResultCount,
    progress_percent: row.progressPercent,
    summary_metrics: safeParse(row.summaryMetricsJson, {}) as ReportSummary["summary_metrics"],
    published_at: row.publishedAt,
    created_at: row.createdAt
  };
}

function toReportStore(row: typeof reportStoreTable.$inferSelect): any {
  return {
    id: row.id,
    report_id: row.reportId,
    store_id: row.storeId,
    store_name: row.storeName,
    organization_name: row.organizationName,
    progress_state: row.progressState as ProgressState,
    issue_count: row.issueCount,
    image_count: row.imageCount,
    total_result_count: row.totalResultCount,
    completed_result_count: row.completedResultCount,
    pending_result_count: row.pendingResultCount,
    progress_percent: row.progressPercent,
    metadata: safeParse(row.metadataJson, {}),
    state_snapshot: safeParse(row.stateSnapshotJson, {}),
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportResult(row: typeof reportImageTable.$inferSelect): any {
  return {
    id: row.id,
    report_id: row.reportId,
    store_id: row.storeId,
    store_name: row.storeName,
    object_key: row.objectKey,
    bucket: row.bucket,
    region: row.region,
    url: row.url,
    width: row.width,
    height: row.height,
    captured_at: row.capturedAt,
    review_state: row.reviewState as ResultReviewState,
    reviewed_by: row.reviewedBy,
    reviewed_at: row.reviewedAt,
    review_note: row.reviewNote,
    review_action: row.reviewAction,
    review_disposition: row.reviewDisposition,
    review_payload: safeParse(row.reviewPayloadJson, {}),
    metadata: safeParse(row.metadataJson, {}),
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportResultNavigation(row: {
  id: number;
  reportId: number;
  storeId: string | null;
  storeName: string | null;
  capturedAt: string | null;
  reviewState: string;
  displayOrder: number;
  createdAt: string;
}): ReportResult {
  return {
    id: row.id,
    report_id: row.reportId,
    store_id: row.storeId,
    store_name: row.storeName,
    object_key: null,
    bucket: null,
    region: null,
    url: "",
    width: null,
    height: null,
    captured_at: row.capturedAt,
    review_state: normalizeResultReviewState(row.reviewState),
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    review_action: "",
    review_disposition: "",
    review_payload: {},
    metadata: {},
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportIssue(row: typeof reportIssueTable.$inferSelect): any {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    store_id: row.storeId,
    store_name: row.storeName,
    title: row.title,
    category: row.category,
    severity: row.severity,
    description: row.description,
    suggestion: row.suggestion,
    image_url: row.imageUrl,
    image_object_key: row.imageObjectKey,
    review_state: row.reviewState as ResultReviewState,
    metadata: safeParse(row.metadataJson, {}),
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportInspection(row: typeof reportInspectionTable.$inferSelect): any {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    store_id: row.storeId,
    store_name: row.storeName,
    inspection_id: row.inspectionId,
    skill_id: row.skillId,
    skill_name: row.skillName,
    status: row.status,
    raw_result: row.rawResult,
    error_message: row.errorMessage,
    metadata: safeParse(row.metadataJson, {}),
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportReviewLog(row: typeof reportReviewLogTable.$inferSelect): any {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    store_id: row.storeId,
    store_name: row.storeName,
    from_status: row.fromStatus as ResultReviewState,
    to_status: row.toStatus as ResultReviewState,
    operator_name: row.operatorName,
    note: row.note,
    review_action: row.reviewAction,
    review_disposition: row.reviewDisposition,
    metadata: safeParse(row.metadataJson, {}),
    created_at: row.createdAt
  };
}

function normalizeSelectedIssues(values: ReviewSelectedIssue[] | undefined): any {
  return Array.from(
    new Map(
      (values || [])
        .map((item) => ({
          id: Number(item.id),
          title: String(item.title || "").trim()
        }))
        .filter((item) => Number.isInteger(item.id) && item.id > 0 && item.title)
        .map((item) => [item.id, item] as const)
    ).values()
  );
}

function normalizeReviewAction(value: ReviewAction | undefined, reviewState: ResultReviewState): any {
  if (value === "create_rectification" || value === "complete_only" || value === "reopen") {
    return value;
  }
  return reviewState === "completed" ? "complete_only" : "reopen";
}

function normalizeReviewDisposition(value: ReviewDisposition | undefined): any {
  if (
    value === "rectification_required" ||
    value === "no_rectification" ||
    value === "offline_handled" ||
    value === "false_positive" ||
    value === "other"
  ) {
    return value;
  }
  return "";
}

function isAutoCompletedReviewPayload(json: string): any {
  const payload = safeParse(json, {});
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Record<string, unknown>).auto_completed === true);
}

function resolveResultOriginalImageUrl(result: typeof reportImageTable.$inferSelect): any {
  const metadata = safeParse(result.metadataJson, {});
  return readMetadataString(metadata, "preview_url") ||
    readMetadataString(metadata, "display_url") ||
    result.url ||
    readMetadataString(metadata, "capture_url") ||
    "";
}

function filterStoresByScope(stores: ReportStore[], scopedStoreIds: string[] | null): any {
  if (!scopedStoreIds) {
    return stores;
  }
  return stores.filter((store) => scopedStoreIds.includes(store.store_id));
}

function filterResultsByScope(results: ReportResult[], scopedStoreIds: string[] | null): any {
  if (!scopedStoreIds) {
    return results;
  }
  return results.filter((result) => result.store_id && scopedStoreIds.includes(result.store_id));
}

function filterIssuesByScope(issues: ReportIssue[], scopedStoreIds: string[] | null): any {
  if (!scopedStoreIds) {
    return issues;
  }
  return issues.filter((issue) => issue.store_id && scopedStoreIds.includes(issue.store_id));
}

function filterLogsByScope(logs: ReportReviewLog[], scopedStoreIds: string[] | null): any {
  if (!scopedStoreIds) {
    return logs;
  }
  return logs.filter((log) => log.store_id && scopedStoreIds.includes(log.store_id));
}

function filterInspectionsByScope(inspections: ReportInspection[], scopedStoreIds: string[] | null): any {
  if (!scopedStoreIds) {
    return inspections;
  }
  return inspections.filter((inspection) => inspection.store_id && scopedStoreIds.includes(inspection.store_id));
}

function summarizeStores(stores: ReportStore[]): any {
  const completedStoreCount = stores.filter((store) => store.progress_state === "completed").length;
  const inProgressStoreCount = stores.filter((store) => store.progress_state === "in_progress").length;
  const pendingStoreCount = stores.length - completedStoreCount - inProgressStoreCount;
  return {
    completed_store_count: completedStoreCount,
    pending_store_count: pendingStoreCount,
    in_progress_store_count: inProgressStoreCount
  };
}

function combineWhere(...conditions: Array<any | undefined>): any {
  const active = conditions.filter(Boolean) as any[];
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }
  return and(...active);
}

function normalizeDetailReviewStatus(value: string): "pending" | "in_progress" | "completed" | "" {
  if (value === "pending" || value === "in_progress" || value === "completed") {
    return value;
  }
  return "";
}

function normalizeDetailSemanticState(value: string): "issue_found" | "pass" | "inconclusive" | "inspection_failed" | "" {
  if (value === "issue_found" || value === "pass" || value === "inconclusive" || value === "inspection_failed") {
    return value;
  }
  return "";
}

function storeMatchesDetailFilters(
  store: ReportStore,
  filters: { organization: string; storeId: string; reviewStatus: string }
): boolean {
  if (filters.organization && store.organization_name !== filters.organization) {
    return false;
  }
  if (filters.storeId && store.store_id !== filters.storeId) {
    return false;
  }
  if (filters.reviewStatus && store.progress_state !== filters.reviewStatus) {
    return false;
  }
  return true;
}

function resultMatchesDetailFilters(
  result: ReportResult,
  scopedStoreIds: Set<string>,
  filters: { organization: string; storeId: string; reviewStatus: string }
): boolean {
  if (filters.storeId && result.store_id !== filters.storeId) {
    return false;
  }
  if (filters.organization || filters.storeId || filters.reviewStatus) {
    if (result.store_id && scopedStoreIds.size > 0 && !scopedStoreIds.has(result.store_id)) {
      return false;
    }
    if ((filters.organization || filters.storeId) && result.store_id && scopedStoreIds.size === 0) {
      return false;
    }
  }
  if (filters.reviewStatus && filters.reviewStatus !== "in_progress" && result.review_state !== filters.reviewStatus) {
    return false;
  }
  return true;
}

function issueMatchesDetailFilters(
  issue: Pick<ReportIssue, "store_id" | "review_state">,
  scopedStoreIds: Set<string>,
  filters: { organization: string; storeId: string; reviewStatus: string }
): boolean {
  if (filters.storeId && issue.store_id !== filters.storeId) {
    return false;
  }
  if (filters.organization || filters.storeId || filters.reviewStatus) {
    if (issue.store_id && scopedStoreIds.size > 0 && !scopedStoreIds.has(issue.store_id)) {
      return false;
    }
    if ((filters.organization || filters.storeId) && issue.store_id && scopedStoreIds.size === 0) {
      return false;
    }
  }
  if (filters.reviewStatus && filters.reviewStatus !== "in_progress" && issue.review_state !== filters.reviewStatus) {
    return false;
  }
  return true;
}

function inspectionMatchesDetailFilters(
  inspection: Pick<ReportInspection, "store_id">,
  scopedStoreIds: Set<string>,
  filters: { organization: string; storeId: string; reviewStatus: string }
): boolean {
  if (filters.storeId && inspection.store_id !== filters.storeId) {
    return false;
  }
  if (filters.organization || filters.storeId || filters.reviewStatus) {
    if (inspection.store_id && scopedStoreIds.size > 0 && !scopedStoreIds.has(inspection.store_id)) {
      return false;
    }
    if ((filters.organization || filters.storeId) && inspection.store_id && scopedStoreIds.size === 0) {
      return false;
    }
  }
  return true;
}

export class PgReportRepository implements ReportRepository {
  private buildReportWhere(filters: ReportFilters): any {
    const whereClauses = [];
    if (filters.enterprise) {
      whereClauses.push(
        or(
          ilike(reportTable.enterpriseName, `%${filters.enterprise}%`),
          ilike(reportTable.sourceEnterpriseId, `%${filters.enterprise}%`)
        )
      );
    }
    if (filters.publishId) {
      whereClauses.push(ilike(reportTable.publishId, `%${filters.publishId}%`));
    }
    if (filters.reportType) {
      whereClauses.push(eq(reportTable.reportType, filters.reportType));
    }
    if (filters.reviewStatus) {
      whereClauses.push(eq(reportTable.progressState, filters.reviewStatus));
    }
    if (filters.startDate) {
      whereClauses.push(gte(reportTable.periodStart, filters.startDate));
    }
    if (filters.endDate) {
      whereClauses.push(lte(reportTable.periodEnd, filters.endDate));
    }
    return whereClauses.length > 0 ? and(...whereClauses) : undefined;
  }

  private async resolveVisibleReportIds(filters: ReportFilters, context: RequestContext): Promise<number[]> {
    const whereCondition = this.buildReportWhere(filters);
    const candidates = await db
      .select({
        id: reportTable.id,
        sourceEnterpriseId: reportTable.sourceEnterpriseId
      })
      .from(reportTable)
      .where(whereCondition)
      .orderBy(desc(reportTable.publishedAt), desc(reportTable.id));

    const enterpriseScoped = candidates.filter((row) => canAccessEnterprise(context, row.sourceEnterpriseId));
    const scopedStoreIds = await resolveScopedStoreIds(context);
    if (!scopedStoreIds) {
      return enterpriseScoped.map((row) => row.id);
    }
    if (scopedStoreIds.length === 0 || enterpriseScoped.length === 0) {
      return [];
    }
    const reportIds = enterpriseScoped.map((row) => row.id);
    const visibleReportIds = new Set(
      (await db
        .select({ reportId: reportStoreTable.reportId })
        .from(reportStoreTable)
        .where(and(inArray(reportStoreTable.reportId, reportIds), inArray(reportStoreTable.storeId, scopedStoreIds)))).map(
        (row) => row.reportId
      )
    );
    return enterpriseScoped.map((row) => row.id).filter((id) => visibleReportIds.has(id));
  }

  async publishReport(payload: ReportPublishPayload, _context: RequestContext = {}): Promise<any> {
    const receivedAt = new Date().toISOString();
    const normalized = normalizePublishedReport(payload);

    const existingByPublishId = (await db
          .select({
            id: reportTable.id,
            publishId: reportTable.publishId,
            reportVersion: reportTable.reportVersion
          })
          .from(reportTable)
          .where(eq(reportTable.publishId, normalized.publishId)))[0];

    if (existingByPublishId) {
      return {
        success: true,
        action: "duplicate_publish_id",
        reportId: existingByPublishId.id,
        publishId: existingByPublishId.publishId,
        reportVersion: existingByPublishId.reportVersion,
        receivedAt
      };
    }

    const existingByVersion = (await db
          .select({
            id: reportTable.id,
            publishId: reportTable.publishId,
            reportVersion: reportTable.reportVersion
          })
          .from(reportTable)
          .where(
            and(
              eq(reportTable.sourceEnterpriseId, normalized.sourceEnterpriseId),
              eq(reportTable.reportType, normalized.reportType),
              eq(reportTable.reportVersion, normalized.reportVersion)
            )
          ))[0];

    if (existingByVersion) {
      return {
        success: true,
        action: "duplicate_version",
        reportId: existingByVersion.id,
        publishId: existingByVersion.publishId,
        reportVersion: existingByVersion.reportVersion,
        receivedAt
      };
    }

    const reportId = await db.transaction(async (tx): Promise<any> => {
      const inserted = (await tx
              .insert(reportTable)
              .values({
                publishId: normalized.publishId,
                sourceSystem: normalized.sourceSystem,
                sourceEnterpriseId: normalized.sourceEnterpriseId,
                enterpriseName: normalized.enterpriseName,
                reportType: normalized.reportType,
                reportVersion: normalized.reportVersion,
                progressState: normalized.progress_state,
                periodStart: normalized.periodStart,
                periodEnd: normalized.periodEnd,
                operatorName: normalized.operatorName,
                storeCount: normalized.storeCount,
                imageCount: normalized.imageCount,
                issueCount: normalized.issueCount,
                completedStoreCount: normalized.completedStoreCount,
                pendingStoreCount: normalized.pendingStoreCount,
                inProgressStoreCount: normalized.inProgressStoreCount,
                totalResultCount: normalized.total_result_count,
                completedResultCount: normalized.completed_result_count,
                pendingResultCount: normalized.pending_result_count,
                progressPercent: normalized.progress_percent,
                summaryMetricsJson: safeStringify(normalized.summaryMetrics),
                stateSnapshotJson: safeStringify(normalized.stateSnapshot),
                extensionsJson: safeStringify(normalized.extensions),
                publishedAt: normalized.publishedAt
              })
              .returning({ id: reportTable.id }))[0];

      await tx
                .insert(reportSourceSnapshotTable)
                .values({
                  reportId: inserted.id,
                  sourceSystem: normalized.sourceSystem,
                  payloadVersion: normalized.payloadVersion,
                  payloadHash: normalized.payloadHash,
                  payloadJson: safeStringify(normalized.rawPayload),
                  publishedAt: normalized.publishedAt,
                  receivedAt
                });

      for (const [index, store] of normalized.stores.entries()) {
        await tx
          .insert(reportStoreTable)
          .values({
            reportId: inserted.id,
            storeId: store.store_id,
            storeName: store.store_name,
            organizationName: store.organization_name,
            progressState: store.progress_state,
            issueCount: store.issue_count,
            imageCount: store.image_count,
            totalResultCount: store.total_result_count,
            completedResultCount: store.completed_result_count,
            pendingResultCount: store.pending_result_count,
            progressPercent: store.progress_percent,
            metadataJson: safeStringify(store.metadata),
            stateSnapshotJson: safeStringify(store.state_snapshot),
            displayOrder: index
          });
      }

      const resultMap = new Map<string, number>();
      for (const [index, image] of normalized.images.entries()) {
        const insertedResult = (await tx
          .insert(reportImageTable)
          .values({
            reportId: inserted.id,
            storeId: image.store_id ?? null,
            storeName: image.store_name ?? null,
            objectKey: image.object_key ?? null,
            bucket: image.bucket ?? null,
            region: image.region ?? null,
            url: image.url,
            width: image.width ?? null,
            height: image.height ?? null,
            capturedAt: image.captured_at ?? null,
            reviewState: image.review_state,
            reviewedBy: image.reviewed_by,
            reviewedAt: image.reviewed_at,
            reviewNote: image.review_note,
            reviewPayloadJson: safeStringify(image.review_payload),
            metadataJson: safeStringify(image.metadata),
            displayOrder: index
          })
          .returning({ id: reportImageTable.id }))[0];

        const captureId = readMetadataString(image.metadata, "capture_id");
        const imageExternalId = readMetadataString(image.metadata, "image_id");
        if (captureId) {
          resultMap.set(`capture:${captureId}`, insertedResult.id);
        }
        if (imageExternalId) {
          resultMap.set(`image:${imageExternalId}`, insertedResult.id);
        }
      }

      for (const [index, issue] of normalized.issues.entries()) {
        const captureId = readMetadataString(issue.metadata, "capture_id");
        const imageExternalId = readMetadataString(issue.metadata, "image_id");
        const resultId = resultMap.get(`capture:${captureId}`) ?? resultMap.get(`image:${imageExternalId}`) ?? null;

        await tx
          .insert(reportIssueTable)
          .values({
            reportId: inserted.id,
            resultId,
            storeId: issue.store_id ?? null,
            storeName: issue.store_name ?? null,
            title: issue.title,
            category: issue.category ?? null,
            severity: issue.severity ?? null,
            description: issue.description ?? null,
            suggestion: issue.suggestion ?? null,
            imageUrl: issue.image_url ?? null,
            imageObjectKey: issue.image_object_key ?? null,
            reviewState: issue.review_state,
            metadataJson: safeStringify(issue.metadata),
            displayOrder: index
          });
      }

      for (const [index, inspection] of normalized.inspections.entries()) {
        const captureId = readMetadataString(inspection.metadata, "capture_id");
        const imageExternalId = readMetadataString(inspection.metadata, "image_id");
        const resultId = resultMap.get(`capture:${captureId}`) ?? resultMap.get(`image:${imageExternalId}`) ?? null;

        await tx
          .insert(reportInspectionTable)
          .values({
            reportId: inserted.id,
            resultId,
            storeId: inspection.store_id ?? null,
            storeName: inspection.store_name ?? null,
            inspectionId: inspection.inspection_id,
            skillId: inspection.skill_id,
            skillName: inspection.skill_name ?? null,
            status: inspection.status ?? null,
            rawResult: inspection.raw_result ?? null,
            errorMessage: inspection.error_message ?? null,
            metadataJson: safeStringify(inspection.metadata),
            displayOrder: index
          });
      }

      return inserted.id;
    });

    return {
      success: true,
      action: "created",
      reportId,
      publishId: normalized.publishId,
      reportVersion: normalized.reportVersion,
      receivedAt
    };
  }

  async getPublishStatus(publishId: string, _context: RequestContext = {}): Promise<any> {
    const receivedAt = new Date().toISOString();
    const row = (await db
          .select({
            id: reportTable.id,
            publishId: reportTable.publishId,
            reportVersion: reportTable.reportVersion
          })
          .from(reportTable)
          .where(eq(reportTable.publishId, publishId)))[0];

    if (!row) {
      return {
        success: true,
        exists: false,
        status: "missing",
        publishId,
        receivedAt
      };
    }

    return {
      success: true,
      exists: true,
      status: "published",
      reportId: row.id,
      publishId: row.publishId,
      reportVersion: row.reportVersion,
      receivedAt
    };
  }

  async listReports(filters: ReportFilters = {}, context: RequestContext = {}): Promise<any> {
    const visibleIds = await this.resolveVisibleReportIds(filters, context);
    if (visibleIds.length === 0) {
      return [];
    }
    const rows = await db.select().from(reportTable).where(inArray(reportTable.id, visibleIds));
    const rowById = new Map(rows.map((row) => [row.id, row] as const));
    return visibleIds.map((id) => rowById.get(id)).filter(Boolean).map((row) => toReportSummary(row));
  }

  async queryReportsPage(filters: ReportFilters, page: number, pageSize: number, context: RequestContext = {}): Promise<any> {
    const normalizedPageSize = Math.max(1, Math.min(200, Math.trunc(pageSize || 20)));
    const visibleIds = await this.resolveVisibleReportIds(filters, context);
    const total = visibleIds.length;
    const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
    const currentPage = Math.min(Math.max(1, Math.trunc(page || 1)), totalPages);
    const offset = (currentPage - 1) * normalizedPageSize;
    const pageIds = visibleIds.slice(offset, offset + normalizedPageSize);

    if (pageIds.length === 0) {
      return {
        page: currentPage,
        page_size: normalizedPageSize,
        total,
        items: []
      };
    }

    const rows = await db.select().from(reportTable).where(inArray(reportTable.id, pageIds));
    const rowById = new Map(rows.map((row) => [row.id, row] as const));
    const items = pageIds.map((id) => rowById.get(id)).filter(Boolean).map((row) => toReportSummary(row));
    return {
      page: currentPage,
      page_size: normalizedPageSize,
      total,
      items
    };
  }

  async getReportListOverview(context: RequestContext = {}): Promise<any> {
    const visibleIds = await this.resolveVisibleReportIds({}, context);
    if (visibleIds.length === 0) {
      return {
        total_reports: 0,
        pending_reports: 0,
        total_issues: 0,
        total_images: 0,
        report_types: []
      };
    }

    const rows = await db
      .select({
        reportType: reportTable.reportType,
        pendingResultCount: reportTable.pendingResultCount,
        issueCount: reportTable.issueCount,
        totalResultCount: reportTable.totalResultCount
      })
      .from(reportTable)
      .where(inArray(reportTable.id, visibleIds));

    return {
      total_reports: rows.length,
      pending_reports: rows.filter((row) => Number(row.pendingResultCount || 0) > 0).length,
      total_issues: rows.reduce((sum, row) => sum + Number(row.issueCount || 0), 0),
      total_images: rows.reduce((sum, row) => sum + Number(row.totalResultCount || 0), 0),
      report_types: Array.from(
        new Set(rows.map((row) => String(row.reportType || "").trim()).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"))
    };
  }

  async getReportDetail(reportId: number, context: RequestContext = {}): Promise<any> {
    const reportRow = (await db.select().from(reportTable).where(eq(reportTable.id, reportId)))[0];

    if (!reportRow) {
      return null;
    }

    if (!canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return null;
    }

    const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    if (scopedStoreIds && scopedStoreIds.length === 0) {
      return null;
    }
    const storeScope = scopedStoreIds ? inArray(reportStoreTable.storeId, scopedStoreIds) : undefined;
    const resultScope = scopedStoreIds ? inArray(reportImageTable.storeId, scopedStoreIds) : undefined;
    const issueScope = scopedStoreIds ? inArray(reportIssueTable.storeId, scopedStoreIds) : undefined;
    const inspectionScope = scopedStoreIds ? inArray(reportInspectionTable.storeId, scopedStoreIds) : undefined;
    const logScope = scopedStoreIds ? inArray(reportReviewLogTable.storeId, scopedStoreIds) : undefined;

    const [stores, results, issues, inspections, reviewLogs] = await Promise.all([
      db
        .select()
        .from(reportStoreTable)
        .where(combineWhere(eq(reportStoreTable.reportId, reportId), storeScope))
        .orderBy(reportStoreTable.displayOrder, reportStoreTable.id),
      db
        .select()
        .from(reportImageTable)
        .where(combineWhere(eq(reportImageTable.reportId, reportId), resultScope))
        .orderBy(reportImageTable.displayOrder, reportImageTable.id),
      db
        .select()
        .from(reportIssueTable)
        .where(combineWhere(eq(reportIssueTable.reportId, reportId), issueScope))
        .orderBy(reportIssueTable.displayOrder, reportIssueTable.id),
      db
        .select()
        .from(reportInspectionTable)
        .where(combineWhere(eq(reportInspectionTable.reportId, reportId), inspectionScope))
        .orderBy(reportInspectionTable.displayOrder, reportInspectionTable.id),
      db
        .select()
        .from(reportReviewLogTable)
        .where(combineWhere(eq(reportReviewLogTable.reportId, reportId), logScope))
        .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
        .limit(20)
    ]);

    const visibleStores = stores.map(toReportStore);
    const visibleResults = results.map(toReportResult);
    const visibleIssues = issues.map(toReportIssue);
    const visibleInspections = inspections.map(toReportInspection);
    const visibleLogs = reviewLogs.map(toReportReviewLog);

    const scopedStoreSummary = summarizeStores(visibleStores);
    const scopedResultProgress = buildProgressSummary(
      visibleResults.length,
      visibleResults.filter((result) => result.review_state === "completed").length
    );

    return {
      ...toReportSummary(reportRow),
      progress_state: scopedStoreIds ? scopedResultProgress.progress_state : (reportRow.progressState as ProgressState),
      store_count: visibleStores.length,
      image_count: visibleResults.length,
      issue_count: visibleIssues.length,
      completed_store_count: scopedStoreIds ? scopedStoreSummary.completed_store_count : reportRow.completedStoreCount,
      pending_store_count: scopedStoreIds ? scopedStoreSummary.pending_store_count : reportRow.pendingStoreCount,
      in_progress_store_count: scopedStoreIds ? scopedStoreSummary.in_progress_store_count : reportRow.inProgressStoreCount,
      total_result_count: scopedStoreIds ? scopedResultProgress.total_result_count : reportRow.totalResultCount,
      completed_result_count: scopedStoreIds ? scopedResultProgress.completed_result_count : reportRow.completedResultCount,
      pending_result_count: scopedStoreIds ? scopedResultProgress.pending_result_count : reportRow.pendingResultCount,
      progress_percent: scopedStoreIds ? scopedResultProgress.progress_percent : reportRow.progressPercent,
      stores: visibleStores,
      results: visibleResults,
      images: visibleResults,
      issues: visibleIssues,
      inspections: visibleInspections,
      review_logs: visibleLogs
    };
  }

  async getReportDetailPage(
    reportId: number,
    input: {
      organization?: string;
      storeId?: string;
      reviewStatus?: string;
      semanticState?: string;
      page?: number;
      pageSize?: number;
    },
    context: RequestContext = {}
  ): Promise<any> {
    const reportRow = (await db.select().from(reportTable).where(eq(reportTable.id, reportId)))[0];
    if (!reportRow) {
      return null;
    }
    if (!canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return null;
    }

    const normalizedReviewStatus = normalizeDetailReviewStatus(String(input.reviewStatus || ""));
    const normalizedSemanticState = normalizeDetailSemanticState(String(input.semanticState || ""));
    const filters = {
      organization: String(input.organization || "").trim(),
      storeId: String(input.storeId || "").trim(),
      reviewStatus: normalizedReviewStatus
    };
    const pageSize = Math.max(1, Math.min(200, Math.trunc(input.pageSize || 30)));
    const requestedPage = Math.max(1, Math.trunc(input.page || 1));

    const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    if (scopedStoreIds && scopedStoreIds.length === 0) {
      return null;
    }
    const storeScope = scopedStoreIds ? inArray(reportStoreTable.storeId, scopedStoreIds) : undefined;
    const resultScope = scopedStoreIds ? inArray(reportImageTable.storeId, scopedStoreIds) : undefined;
    const issueScope = scopedStoreIds ? inArray(reportIssueTable.storeId, scopedStoreIds) : undefined;
    const inspectionScope = scopedStoreIds ? inArray(reportInspectionTable.storeId, scopedStoreIds) : undefined;
    const logScope = scopedStoreIds ? inArray(reportReviewLogTable.storeId, scopedStoreIds) : undefined;

    const [storeRows, resultRows, issueRows, inspectionRows, reviewLogRows] = await Promise.all([
      db
        .select()
        .from(reportStoreTable)
        .where(combineWhere(eq(reportStoreTable.reportId, reportId), storeScope))
        .orderBy(reportStoreTable.displayOrder, reportStoreTable.id),
      db
        .select()
        .from(reportImageTable)
        .where(combineWhere(eq(reportImageTable.reportId, reportId), resultScope))
        .orderBy(reportImageTable.displayOrder, reportImageTable.id),
      db
        .select({
          id: reportIssueTable.id,
          resultId: reportIssueTable.resultId,
          storeId: reportIssueTable.storeId,
          reviewState: reportIssueTable.reviewState,
          metadataJson: reportIssueTable.metadataJson
        })
        .from(reportIssueTable)
        .where(combineWhere(eq(reportIssueTable.reportId, reportId), issueScope)),
      db
        .select({
          id: reportInspectionTable.id,
          resultId: reportInspectionTable.resultId,
          storeId: reportInspectionTable.storeId,
          status: reportInspectionTable.status,
          errorMessage: reportInspectionTable.errorMessage,
          metadataJson: reportInspectionTable.metadataJson,
          rawResult: sql<string>`left(coalesce(${reportInspectionTable.rawResult}, ''), 512)`
        })
        .from(reportInspectionTable)
        .where(combineWhere(eq(reportInspectionTable.reportId, reportId), inspectionScope)),
      db
        .select()
        .from(reportReviewLogTable)
        .where(combineWhere(eq(reportReviewLogTable.reportId, reportId), logScope))
        .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
        .limit(20)
    ]);

    const visibleStores = storeRows.map(toReportStore);
    const storeScopedByFilters = new Set(
      visibleStores.filter((store) => storeMatchesDetailFilters(store, filters)).map((store) => store.store_id)
    );

    const allScopedResults = resultRows
      .map(toReportResult)
      .filter((result) => resultMatchesDetailFilters(result, storeScopedByFilters, filters));

    const imageIdsByCaptureId = new Map<string, number[]>();
    const imageIdsByStoreId = new Map<string, number[]>();
    const resultIds = new Set<number>();
    allScopedResults.forEach((result) => {
      resultIds.add(result.id);
      const captureId = readMetadataString(result.metadata, "capture_id");
      if (captureId) {
        const bucket = imageIdsByCaptureId.get(captureId);
        if (bucket) {
          bucket.push(result.id);
        } else {
          imageIdsByCaptureId.set(captureId, [result.id]);
        }
      }
      if (result.store_id) {
        const bucket = imageIdsByStoreId.get(result.store_id);
        if (bucket) {
          bucket.push(result.id);
        } else {
          imageIdsByStoreId.set(result.store_id, [result.id]);
        }
      }
    });

    const scopedIssues = issueRows
      .map((row) => ({
        result_id: row.resultId,
        store_id: row.storeId,
        review_state: row.reviewState as ResultReviewState,
        metadata: safeParse(row.metadataJson, {})
      }))
      .filter((issue) => issueMatchesDetailFilters(issue, storeScopedByFilters, filters));

    const scopedInspections = inspectionRows
      .map((row) => ({
        result_id: row.resultId,
        store_id: row.storeId,
        status: row.status,
        raw_result: row.rawResult || null,
        error_message: row.errorMessage,
        metadata: safeParse(row.metadataJson, {})
      }))
      .filter((inspection) => inspectionMatchesDetailFilters(inspection, storeScopedByFilters, filters));

    const issueCountByImageId = new Map<number, number>();
    scopedIssues.forEach((issue) => {
      const matchedImageIds = new Set<number>();
      if (issue.result_id && resultIds.has(issue.result_id)) {
        matchedImageIds.add(issue.result_id);
      }
      const captureId = readMetadataString(issue.metadata, "capture_id");
      if (captureId) {
        (imageIdsByCaptureId.get(captureId) || []).forEach((id) => matchedImageIds.add(id));
      }
      if (matchedImageIds.size === 0 && issue.store_id) {
        (imageIdsByStoreId.get(issue.store_id) || []).forEach((id) => matchedImageIds.add(id));
      }
      matchedImageIds.forEach((id) => {
        issueCountByImageId.set(id, Number(issueCountByImageId.get(id) || 0) + 1);
      });
    });

    const inspectionsByImageId = new Map<number, Array<{ status: string | null; raw_result: string | null; error_message: string | null }>>();
    scopedInspections.forEach((inspection) => {
      const matchedImageIds = new Set<number>();
      if (inspection.result_id && resultIds.has(inspection.result_id)) {
        matchedImageIds.add(inspection.result_id);
      }
      const captureId = readMetadataString(inspection.metadata, "capture_id");
      if (captureId) {
        (imageIdsByCaptureId.get(captureId) || []).forEach((id) => matchedImageIds.add(id));
      }
      if (matchedImageIds.size === 0 && inspection.store_id) {
        (imageIdsByStoreId.get(inspection.store_id) || []).forEach((id) => matchedImageIds.add(id));
      }
      matchedImageIds.forEach((id) => {
        const bucket = inspectionsByImageId.get(id);
        const normalized = {
          status: inspection.status,
          raw_result: inspection.raw_result,
          error_message: inspection.error_message
        };
        if (bucket) {
          bucket.push(normalized);
        } else {
          inspectionsByImageId.set(id, [normalized]);
        }
      });
    });

    const semanticCounts = {
      issue_found: 0,
      pass: 0,
      inconclusive: 0,
      inspection_failed: 0
    };
    const semanticDecoratedResults = allScopedResults.map((result) => {
      const issueCount = Number(issueCountByImageId.get(result.id) || 0);
      const semanticState = classifyReportResultSemantics(
        issueCount,
        inspectionsByImageId.get(result.id) || []
      );
      semanticCounts[semanticState] += 1;
      return {
        ...result,
        semantic_state: semanticState,
        semantic_issue_count: issueCount
      };
    });

    const filteredBySemantic = normalizedSemanticState
      ? semanticDecoratedResults.filter((result) => result.semantic_state === normalizedSemanticState)
      : semanticDecoratedResults;
    const filteredResultCount = filteredBySemantic.length;
    const filteredPendingCount = filteredBySemantic.filter((result) => result.review_state === "pending").length;
    const filteredReviewedCount = filteredResultCount - filteredPendingCount;
    const totalPages = Math.max(1, Math.ceil(filteredResultCount / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const pageStart = (currentPage - 1) * pageSize;
    const pagedResults = filteredBySemantic.slice(pageStart, pageStart + pageSize);

    const scopedStoreSummary = summarizeStores(visibleStores.filter((store) => storeMatchesDetailFilters(store, filters)));
    const scopedResultProgress = buildProgressSummary(
      semanticDecoratedResults.length,
      semanticDecoratedResults.filter((result) => result.review_state === "completed").length
    );

    return {
      ...toReportSummary(reportRow),
      progress_state: scopedStoreIds ? scopedResultProgress.progress_state : (reportRow.progressState as ProgressState),
      store_count: visibleStores.length,
      image_count: semanticDecoratedResults.length,
      issue_count: Array.from(issueCountByImageId.values()).reduce((sum, count) => sum + count, 0),
      completed_store_count: scopedStoreIds ? scopedStoreSummary.completed_store_count : reportRow.completedStoreCount,
      pending_store_count: scopedStoreIds ? scopedStoreSummary.pending_store_count : reportRow.pendingStoreCount,
      in_progress_store_count: scopedStoreIds ? scopedStoreSummary.in_progress_store_count : reportRow.inProgressStoreCount,
      total_result_count: scopedStoreIds ? scopedResultProgress.total_result_count : reportRow.totalResultCount,
      completed_result_count: scopedStoreIds ? scopedResultProgress.completed_result_count : reportRow.completedResultCount,
      pending_result_count: scopedStoreIds ? scopedResultProgress.pending_result_count : reportRow.pendingResultCount,
      progress_percent: scopedStoreIds ? scopedResultProgress.progress_percent : reportRow.progressPercent,
      stores: visibleStores,
      results: pagedResults,
      images: pagedResults,
      issues: [],
      inspections: [],
      review_logs: reviewLogRows.map(toReportReviewLog),
      semantic_counts: semanticCounts,
      filtered_result_count: filteredResultCount,
      filtered_pending_result_count: filteredPendingCount,
      filtered_reviewed_result_count: filteredReviewedCount,
      current_page: currentPage,
      page_size: pageSize,
      total_pages: totalPages
    };
  }

  async getReportResultDetail(reportId: number, resultId: number, context: RequestContext = {}): Promise<any> {
    const reportRow = (await db.select().from(reportTable).where(eq(reportTable.id, reportId)))[0];
    if (!reportRow) {
      return null;
    }
    if (!canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return null;
    }

    const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    if (scopedStoreIds && scopedStoreIds.length === 0) {
      return null;
    }
    const resultScope = scopedStoreIds ? inArray(reportImageTable.storeId, scopedStoreIds) : undefined;
    const selectedResultRow = (await db
      .select()
      .from(reportImageTable)
      .where(combineWhere(eq(reportImageTable.reportId, reportId), eq(reportImageTable.id, resultId), resultScope)))[0];
    if (!selectedResultRow) {
      return null;
    }

    const selectedResult = toReportResult(selectedResultRow);
    const selectedCaptureId = readMetadataString(selectedResult.metadata, "capture_id");
    const selectedStoreId = selectedResult.store_id || "";

    const issueMatchConditions = [eq(reportIssueTable.resultId, resultId)];
    const inspectionMatchConditions = [eq(reportInspectionTable.resultId, resultId)];
    if (selectedCaptureId) {
      issueMatchConditions.push(sql`${reportIssueTable.metadataJson}::jsonb ->> 'capture_id' = ${selectedCaptureId}`);
      inspectionMatchConditions.push(sql`${reportInspectionTable.metadataJson}::jsonb ->> 'capture_id' = ${selectedCaptureId}`);
    }
    if (selectedStoreId) {
      if (selectedCaptureId) {
        issueMatchConditions.push(
          and(
            eq(reportIssueTable.storeId, selectedStoreId),
            sql`coalesce(${reportIssueTable.metadataJson}::jsonb ->> 'capture_id', '') = ''`
          )
        );
        inspectionMatchConditions.push(
          and(
            eq(reportInspectionTable.storeId, selectedStoreId),
            sql`coalesce(${reportInspectionTable.metadataJson}::jsonb ->> 'capture_id', '') = ''`
          )
        );
      } else {
        issueMatchConditions.push(eq(reportIssueTable.storeId, selectedStoreId));
        inspectionMatchConditions.push(eq(reportInspectionTable.storeId, selectedStoreId));
      }
    }

    const storeScope = scopedStoreIds ? inArray(reportStoreTable.storeId, scopedStoreIds) : undefined;
    const allResultScope = scopedStoreIds ? inArray(reportImageTable.storeId, scopedStoreIds) : undefined;
    const issueScope = scopedStoreIds ? inArray(reportIssueTable.storeId, scopedStoreIds) : undefined;
    const inspectionScope = scopedStoreIds ? inArray(reportInspectionTable.storeId, scopedStoreIds) : undefined;
    const logScope = scopedStoreIds ? inArray(reportReviewLogTable.storeId, scopedStoreIds) : undefined;

    const [stores, navigationResults, issues, inspections, reviewLogs] = await Promise.all([
      db
        .select()
        .from(reportStoreTable)
        .where(combineWhere(eq(reportStoreTable.reportId, reportId), storeScope))
        .orderBy(reportStoreTable.displayOrder, reportStoreTable.id),
      db
        .select({
          id: reportImageTable.id,
          reportId: reportImageTable.reportId,
          storeId: reportImageTable.storeId,
          storeName: reportImageTable.storeName,
          capturedAt: reportImageTable.capturedAt,
          reviewState: reportImageTable.reviewState,
          displayOrder: reportImageTable.displayOrder,
          createdAt: reportImageTable.createdAt
        })
        .from(reportImageTable)
        .where(combineWhere(eq(reportImageTable.reportId, reportId), allResultScope))
        .orderBy(reportImageTable.displayOrder, reportImageTable.id),
      db
        .select()
        .from(reportIssueTable)
        .where(
          combineWhere(eq(reportIssueTable.reportId, reportId), issueScope, or(...issueMatchConditions))
        )
        .orderBy(reportIssueTable.displayOrder, reportIssueTable.id),
      db
        .select()
        .from(reportInspectionTable)
        .where(
          combineWhere(eq(reportInspectionTable.reportId, reportId), inspectionScope, or(...inspectionMatchConditions))
        )
        .orderBy(reportInspectionTable.displayOrder, reportInspectionTable.id),
      db
        .select()
        .from(reportReviewLogTable)
        .where(combineWhere(eq(reportReviewLogTable.reportId, reportId), eq(reportReviewLogTable.resultId, resultId), logScope))
        .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
        .limit(20)
    ]);

    const visibleStores = stores.map(toReportStore);
    const visibleResults = navigationResults.map(toReportResultNavigation);
    const selectedIndex = visibleResults.findIndex((result) => result.id === selectedResult.id);
    if (selectedIndex >= 0) {
      visibleResults[selectedIndex] = selectedResult;
    }
    const visibleIssues = issues.map(toReportIssue);
    const visibleInspections = inspections.map(toReportInspection);
    const visibleLogs = reviewLogs.map(toReportReviewLog);

    const scopedStoreSummary = summarizeStores(visibleStores);
    const scopedResultProgress = buildProgressSummary(
      visibleResults.length,
      visibleResults.filter((result) => result.review_state === "completed").length
    );

    return {
      ...toReportSummary(reportRow),
      progress_state: scopedStoreIds ? scopedResultProgress.progress_state : (reportRow.progressState as ProgressState),
      store_count: visibleStores.length,
      image_count: visibleResults.length,
      issue_count: visibleIssues.length,
      completed_store_count: scopedStoreIds ? scopedStoreSummary.completed_store_count : reportRow.completedStoreCount,
      pending_store_count: scopedStoreIds ? scopedStoreSummary.pending_store_count : reportRow.pendingStoreCount,
      in_progress_store_count: scopedStoreIds ? scopedStoreSummary.in_progress_store_count : reportRow.inProgressStoreCount,
      total_result_count: scopedStoreIds ? scopedResultProgress.total_result_count : reportRow.totalResultCount,
      completed_result_count: scopedStoreIds ? scopedResultProgress.completed_result_count : reportRow.completedResultCount,
      pending_result_count: scopedStoreIds ? scopedResultProgress.pending_result_count : reportRow.pendingResultCount,
      progress_percent: scopedStoreIds ? scopedResultProgress.progress_percent : reportRow.progressPercent,
      stores: visibleStores,
      results: visibleResults,
      images: visibleResults,
      issues: visibleIssues,
      inspections: visibleInspections,
      review_logs: visibleLogs
    };
  }

  createManualIssue(input: CreateManualReportIssueInput, context: RequestContext = {}): any {
    const title = input.title.trim();
    const description = String(input.description || "").trim();
    const operatorName = input.operator_name.trim();
    const inspectionId = String(input.inspection_id || "").trim();
    if (!title || !operatorName) {
      return null;
    }

    return db.transaction(async (tx): Promise<any> => {
      const reportRow = (await tx
              .select({
                id: reportTable.id,
                sourceEnterpriseId: reportTable.sourceEnterpriseId
              })
              .from(reportTable)
              .where(eq(reportTable.id, input.report_id)))[0];
      if (!reportRow || !canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
        return null;
      }

      const resultRow = (await tx
              .select()
              .from(reportImageTable)
              .where(and(eq(reportImageTable.reportId, input.report_id), eq(reportImageTable.id, input.result_id))))[0];
      if (!resultRow) {
        return null;
      }

      const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
      if (scopedStoreIds) {
        const resultStoreId = String(resultRow.storeId || "").trim();
        if (!resultStoreId || !scopedStoreIds.includes(resultStoreId)) {
          return null;
        }
      }

      const linkedInspection = inspectionId
        ? (await tx
                      .select()
                      .from(reportInspectionTable)
                      .where(
                        and(
                          eq(reportInspectionTable.reportId, input.report_id),
                          eq(reportInspectionTable.resultId, input.result_id),
                          eq(reportInspectionTable.inspectionId, inspectionId)
                        )
                      ))[0]
        : (await tx
                      .select()
                      .from(reportInspectionTable)
                      .where(and(eq(reportInspectionTable.reportId, input.report_id), eq(reportInspectionTable.resultId, input.result_id)))
                      .orderBy(reportInspectionTable.displayOrder, reportInspectionTable.id)
                      .limit(1))[0];
      const resultMetadata = safeParse(resultRow.metadataJson, {});
      const imageUrl = resolveResultOriginalImageUrl(resultRow);
      const now = new Date().toISOString();
      const displayOrder = (await tx
              .select({ id: reportIssueTable.id })
              .from(reportIssueTable)
              .where(eq(reportIssueTable.reportId, input.report_id))).length;

      const inserted = (await tx
              .insert(reportIssueTable)
              .values({
                reportId: input.report_id,
                resultId: input.result_id,
                storeId: resultRow.storeId,
                storeName: resultRow.storeName,
                title,
                category: "人工问题",
                severity: "manual",
                description: description || title,
                suggestion: null,
                imageUrl: imageUrl || null,
                imageObjectKey: resultRow.objectKey || readMetadataString(resultMetadata, "oss_key") || null,
                reviewState: "pending",
                metadataJson: safeStringify({
                  issue_id: `manual-${randomUUID()}`,
                  source: "manual_review",
                  manual_issue: true,
                  inspection_id: linkedInspection?.inspectionId ?? inspectionId,
                  linked_inspection_id: linkedInspection?.inspectionId ?? inspectionId,
                  capture_id: readMetadataString(resultMetadata, "capture_id"),
                  image_id: readMetadataString(resultMetadata, "image_id"),
                  store_code: readMetadataString(resultMetadata, "store_code"),
                  skill_id: linkedInspection?.skillId ?? "",
                  skill_name: linkedInspection?.skillName ?? "",
                  capture_url: readMetadataString(resultMetadata, "capture_url"),
                  preview_url: readMetadataString(resultMetadata, "preview_url"),
                  oss_key: readMetadataString(resultMetadata, "oss_key"),
                  original_image_url: imageUrl,
                  display_image_url: imageUrl,
                  evidence_image_url: "",
                  evidence_image_source: "manual_review",
                  extra_json: {
                    source: "manual_review",
                    created_by: operatorName,
                    created_at: now
                  }
                }),
                displayOrder,
                createdAt: now
              })
              .returning())[0];

      await tx
                .update(reportTable)
                .set({
                  issueCount: sql`${reportTable.issueCount} + 1`
                })
                .where(eq(reportTable.id, input.report_id));

      if (resultRow.storeId) {
        await tx
                    .update(reportStoreTable)
                    .set({
                      issueCount: sql`${reportStoreTable.issueCount} + 1`
                    })
                    .where(and(eq(reportStoreTable.reportId, input.report_id), eq(reportStoreTable.storeId, resultRow.storeId)));
      }

      return toReportIssue(inserted);
    });
  }

  updateImageReviewStatus(
    reportId: number,
    imageId: number,
    input: ReviewStatusUpdateInput,
    context: RequestContext = {}
  ): any {
    const normalizedReviewState = normalizeResultReviewState(input.review_status);
    const normalizedOperator = input.operator_name.trim();
    const normalizedNote = String(input.note || "").trim();
    const normalizedSelectedIssues = normalizeSelectedIssues(input.selected_issues);
    const normalizedReviewAction = normalizeReviewAction(input.review_action, normalizedReviewState);
    const normalizedReviewDisposition = normalizeReviewDisposition(input.review_disposition);

    return db.transaction(async (tx): Promise<any> => {
      const reportRow = (await tx
              .select({
                id: reportTable.id,
                sourceEnterpriseId: reportTable.sourceEnterpriseId,
                progressState: reportTable.progressState,
                completedResultCount: reportTable.completedResultCount,
                totalResultCount: reportTable.totalResultCount
              })
              .from(reportTable)
              .where(eq(reportTable.id, reportId)))[0];
      if (!reportRow || !canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
        return null;
      }

      const resultRow = (await tx
              .select()
              .from(reportImageTable)
              .where(and(eq(reportImageTable.reportId, reportId), eq(reportImageTable.id, imageId))))[0];
      if (!resultRow) {
        return null;
      }
      const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
      if (scopedStoreIds) {
        const resultStoreId = String(resultRow.storeId || "").trim();
        if (!resultStoreId || !scopedStoreIds.includes(resultStoreId)) {
          return null;
        }
      }

      const fromState = (resultRow.reviewState as ResultReviewState) || "pending";
      if (fromState === "completed" && !isAutoCompletedReviewPayload(resultRow.reviewPayloadJson)) {
        return {
          report_id: reportId,
          result_id: imageId,
          store_id: resultRow.storeId,
          store_name: resultRow.storeName,
          from_status: fromState,
          to_status: fromState,
          changed: false,
          progress_state: reportRow.progressState as ProgressState,
          completed_result_count: reportRow.completedResultCount,
          total_result_count: reportRow.totalResultCount,
          recent_log: null,
          updated_at: resultRow.reviewedAt ?? resultRow.createdAt
        };
      }
      if (
        fromState === normalizedReviewState &&
        !normalizedNote &&
        normalizedSelectedIssues.length === 0 &&
        !normalizedReviewDisposition
      ) {
        return {
          report_id: reportId,
          result_id: imageId,
          store_id: resultRow.storeId,
          store_name: resultRow.storeName,
          from_status: fromState,
          to_status: normalizedReviewState,
          changed: false,
          progress_state: reportRow.progressState as ProgressState,
          completed_result_count: reportRow.completedResultCount,
          total_result_count: reportRow.totalResultCount,
          recent_log: null,
          updated_at: resultRow.reviewedAt ?? resultRow.createdAt
        };
      }

      const reviewedAt = normalizedReviewState === "completed" ? new Date().toISOString() : null;
      await tx
                .update(reportImageTable)
                .set({
                  reviewState: normalizedReviewState,
                  reviewedBy: normalizedReviewState === "completed" ? normalizedOperator : null,
                  reviewedAt,
                  reviewNote: normalizedNote || null,
                  reviewAction: normalizedReviewAction,
                  reviewDisposition: normalizedReviewDisposition,
                  reviewPayloadJson: safeStringify({
                    note: normalizedNote || null,
                    updated_by: normalizedOperator,
                    updated_at: reviewedAt,
                    state: normalizedReviewState,
                    review_action: normalizedReviewAction,
                    review_disposition: normalizedReviewDisposition,
                    selected_issues: normalizedSelectedIssues
                  })
                })
                .where(eq(reportImageTable.id, imageId));

      await tx
                .update(reportIssueTable)
                .set({ reviewState: normalizedReviewState })
                .where(and(eq(reportIssueTable.reportId, reportId), eq(reportIssueTable.resultId, imageId)));

      const allResults = await tx
              .select({
                id: reportImageTable.id,
                storeId: reportImageTable.storeId,
                reviewState: reportImageTable.reviewState
              })
              .from(reportImageTable)
              .where(eq(reportImageTable.reportId, reportId));

      const resultStatesByStore = new Map<string, ResultReviewState[]>();
      allResults.forEach((row) => {
        const storeId = String(row.storeId || "").trim();
        if (!storeId) {
          return;
        }
        const bucket = resultStatesByStore.get(storeId) || [];
        bucket.push(row.reviewState as ResultReviewState);
        resultStatesByStore.set(storeId, bucket);
      });

      let completedStoreCount = 0;
      let inProgressStoreCount = 0;
      let pendingStoreCount = 0;

      for (const [storeId, states] of resultStatesByStore.entries()) {
        const completedCount = states.filter((state) => state === "completed").length;
        const progress = buildProgressSummary(states.length, completedCount);
        if (progress.progress_state === "completed") {
          completedStoreCount += 1;
        } else if (progress.progress_state === "in_progress") {
          inProgressStoreCount += 1;
        } else {
          pendingStoreCount += 1;
        }

        await tx
          .update(reportStoreTable)
          .set({
            progressState: progress.progress_state,
            totalResultCount: progress.total_result_count,
            completedResultCount: progress.completed_result_count,
            pendingResultCount: progress.pending_result_count,
            progressPercent: progress.progress_percent,
            stateSnapshotJson: safeStringify({
              level: "store",
              result_progress: progress
            })
          })
          .where(and(eq(reportStoreTable.reportId, reportId), eq(reportStoreTable.storeId, storeId)));
      }

      const completedResultCount = allResults.filter((row) => row.reviewState === "completed").length;
      const reportProgress = buildProgressSummary(allResults.length, completedResultCount);
      await tx
                .update(reportTable)
                .set({
                  progressState: reportProgress.progress_state,
                  completedStoreCount,
                  pendingStoreCount,
                  inProgressStoreCount,
                  totalResultCount: reportProgress.total_result_count,
                  completedResultCount: reportProgress.completed_result_count,
                  pendingResultCount: reportProgress.pending_result_count,
                  progressPercent: reportProgress.progress_percent,
                  stateSnapshotJson: safeStringify({
                    level: "report",
                    result_progress: reportProgress,
                    store_progress: {
                      completed_store_count: completedStoreCount,
                      in_progress_store_count: inProgressStoreCount,
                      pending_store_count: pendingStoreCount
                    }
                  })
                })
                .where(eq(reportTable.id, reportId));

      const logRow = (await tx
              .insert(reportReviewLogTable)
              .values({
                reportId,
                resultId: imageId,
                storeId: resultRow.storeId,
                storeName: resultRow.storeName,
                fromStatus: fromState,
                toStatus: normalizedReviewState,
                operatorName: normalizedOperator,
                note: normalizedNote || null,
                reviewAction: normalizedReviewAction,
                reviewDisposition: normalizedReviewDisposition,
                metadataJson: safeStringify({
                  report_progress_state: reportProgress.progress_state,
                  completed_result_count: reportProgress.completed_result_count,
                  total_result_count: reportProgress.total_result_count,
                  result_id: imageId,
                  report_id: reportId,
                  review_action: normalizedReviewAction,
                  review_disposition: normalizedReviewDisposition,
                  selected_issues: normalizedSelectedIssues
                })
              })
              .returning({ id: reportReviewLogTable.id }))[0];

      const recentLogRow = (await tx
              .select()
              .from(reportReviewLogTable)
              .where(eq(reportReviewLogTable.id, logRow.id)))[0];

      const updatedResultRow = (await tx
              .select()
              .from(reportImageTable)
              .where(eq(reportImageTable.id, imageId)))[0];

      return {
        report_id: reportId,
        result_id: imageId,
        store_id: updatedResultRow?.storeId ?? resultRow.storeId,
        store_name: updatedResultRow?.storeName ?? resultRow.storeName,
        from_status: fromState,
        to_status: normalizedReviewState,
        changed: true,
        progress_state: reportProgress.progress_state,
        completed_result_count: reportProgress.completed_result_count,
        total_result_count: reportProgress.total_result_count,
        recent_log: recentLogRow ? toReportReviewLog(recentLogRow) : null,
        updated_at: updatedResultRow?.reviewedAt ?? updatedResultRow?.createdAt ?? resultRow.createdAt
      };
    });
  }

  async listReviewLogs(reportId: number, limit = 20, imageId?: number, context: RequestContext = {}): Promise<any> {
    const reportRow = (await db
          .select({ sourceEnterpriseId: reportTable.sourceEnterpriseId })
          .from(reportTable)
          .where(eq(reportTable.id, reportId)))[0];
    if (!reportRow || !canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return [];
    }
    const query = await db
          .select()
          .from(reportReviewLogTable)
          .where(
            imageId && imageId > 0
              ? and(eq(reportReviewLogTable.reportId, reportId), eq(reportReviewLogTable.resultId, imageId))
              : eq(reportReviewLogTable.reportId, reportId)
          )
          .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
          .limit(Math.min(Math.max(1, Math.trunc(limit)), 100));

    const scopedStoreIds = await resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    return filterLogsByScope(query.map(toReportReviewLog), scopedStoreIds);
  }
}
