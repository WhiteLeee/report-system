import { and, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  organizationMasterTable,
  reportImageTable,
  reportInspectionTable,
  reportIssueTable,
  reportReviewLogTable,
  reportSourceSnapshotTable,
  reportStoreTable,
  reportTable,
  storeMasterProfileTable
} from "@/backend/database/schema";
import { normalizePublishedReport } from "@/backend/report/report-publish-normalizer";
import type { ReportRepository } from "@/backend/report/report.repository";
import type {
  ProgressState,
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
  ReviewResultUpdateResult
} from "@/backend/report/report.types";
import type { JsonValue } from "@/backend/shared/json";

function safeStringify(value: unknown, fallback: unknown = {}): string {
  return JSON.stringify(value ?? fallback);
}

function safeParse(json: string, fallback: JsonValue = {}): JsonValue {
  try {
    return JSON.parse(json) as JsonValue;
  } catch {
    return fallback;
  }
}

function readMetadataString(metadata: JsonValue, key: string): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = metadata[key as keyof typeof metadata];
  return typeof value === "string" ? value : "";
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

function normalizeResultReviewState(value: unknown): ResultReviewState {
  return value === "completed" || value === "reviewed" ? "completed" : "pending";
}

function toReportSummary(row: typeof reportTable.$inferSelect): ReportSummary {
  return {
    id: row.id,
    publish_id: row.publishId,
    source_system: row.sourceSystem,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
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

function toReportStore(row: typeof reportStoreTable.$inferSelect): ReportStore {
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

function toReportResult(row: typeof reportImageTable.$inferSelect): ReportResult {
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
    review_payload: safeParse(row.reviewPayloadJson, {}),
    metadata: safeParse(row.metadataJson, {}),
    display_order: row.displayOrder,
    created_at: row.createdAt
  };
}

function toReportIssue(row: typeof reportIssueTable.$inferSelect): ReportIssue {
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

function toReportInspection(row: typeof reportInspectionTable.$inferSelect): ReportInspection {
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

function toReportReviewLog(row: typeof reportReviewLogTable.$inferSelect): ReportReviewLog {
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
    metadata: safeParse(row.metadataJson, {}),
    created_at: row.createdAt
  };
}

function normalizeScopeIds(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map((item) => item.trim()).filter(Boolean)));
}

function normalizeSelectedIssues(values: ReviewSelectedIssue[] | undefined): ReviewSelectedIssue[] {
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

function canAccessEnterprise(context: RequestContext, enterpriseId: string): boolean {
  const enterpriseScopeIds = normalizeScopeIds(context.enterpriseScopeIds);
  if (enterpriseScopeIds.length === 0) {
    return true;
  }
  return enterpriseScopeIds.includes(enterpriseId);
}

function resolveScopedStoreIds(context: RequestContext, enterpriseId?: string): string[] | null {
  const storeScopeIds = normalizeScopeIds(context.storeScopeIds);
  if (storeScopeIds.length > 0) {
    return storeScopeIds;
  }

  const organizationScopeIds = normalizeScopeIds(context.organizationScopeIds);
  if (organizationScopeIds.length === 0) {
    return null;
  }

  const organizationWhere = [eq(organizationMasterTable.isActive, 1)];
  if (enterpriseId) {
    organizationWhere.push(eq(organizationMasterTable.enterpriseId, enterpriseId));
  }
  const organizationRows = db
    .select({
      enterpriseId: organizationMasterTable.enterpriseId,
      organizeCode: organizationMasterTable.organizeCode,
      parentCode: organizationMasterTable.parentCode
    })
    .from(organizationMasterTable)
    .where(and(...organizationWhere))
    .all()
    .filter((row) => canAccessEnterprise(context, row.enterpriseId));

  const childrenMap = new Map<string, string[]>();
  organizationRows.forEach((row) => {
    const parentCode = String(row.parentCode || "").trim();
    if (!childrenMap.has(parentCode)) {
      childrenMap.set(parentCode, []);
    }
    childrenMap.get(parentCode)?.push(row.organizeCode);
  });

  const allowedOrganizationCodes = new Set<string>();
  const queue = [...organizationScopeIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowedOrganizationCodes.has(current)) {
      continue;
    }
    allowedOrganizationCodes.add(current);
    (childrenMap.get(current) || []).forEach((childCode) => queue.push(childCode));
  }

  if (allowedOrganizationCodes.size === 0) {
    return [];
  }

  const storeWhere = [eq(storeMasterProfileTable.isActive, 1)];
  if (enterpriseId) {
    storeWhere.push(eq(storeMasterProfileTable.enterpriseId, enterpriseId));
  }

  return Array.from(
    new Set(
      db
        .select({
          enterpriseId: storeMasterProfileTable.enterpriseId,
          storeId: storeMasterProfileTable.storeId,
          organizeCode: storeMasterProfileTable.organizeCode
        })
        .from(storeMasterProfileTable)
        .where(and(...storeWhere))
        .all()
        .filter(
          (row) =>
            canAccessEnterprise(context, row.enterpriseId) &&
            allowedOrganizationCodes.has(String(row.organizeCode || "").trim())
        )
        .map((row) => row.storeId)
    )
  );
}

function filterStoresByScope(stores: ReportStore[], scopedStoreIds: string[] | null): ReportStore[] {
  if (!scopedStoreIds) {
    return stores;
  }
  return stores.filter((store) => scopedStoreIds.includes(store.store_id));
}

function filterResultsByScope(results: ReportResult[], scopedStoreIds: string[] | null): ReportResult[] {
  if (!scopedStoreIds) {
    return results;
  }
  return results.filter((result) => result.store_id && scopedStoreIds.includes(result.store_id));
}

function filterIssuesByScope(issues: ReportIssue[], scopedStoreIds: string[] | null): ReportIssue[] {
  if (!scopedStoreIds) {
    return issues;
  }
  return issues.filter((issue) => issue.store_id && scopedStoreIds.includes(issue.store_id));
}

function filterLogsByScope(logs: ReportReviewLog[], scopedStoreIds: string[] | null): ReportReviewLog[] {
  if (!scopedStoreIds) {
    return logs;
  }
  return logs.filter((log) => log.store_id && scopedStoreIds.includes(log.store_id));
}

function filterInspectionsByScope(inspections: ReportInspection[], scopedStoreIds: string[] | null): ReportInspection[] {
  if (!scopedStoreIds) {
    return inspections;
  }
  return inspections.filter((inspection) => inspection.store_id && scopedStoreIds.includes(inspection.store_id));
}

function summarizeStores(stores: ReportStore[]): Pick<ReportSummary, "completed_store_count" | "pending_store_count" | "in_progress_store_count"> {
  const completedStoreCount = stores.filter((store) => store.progress_state === "completed").length;
  const inProgressStoreCount = stores.filter((store) => store.progress_state === "in_progress").length;
  const pendingStoreCount = stores.length - completedStoreCount - inProgressStoreCount;
  return {
    completed_store_count: completedStoreCount,
    pending_store_count: pendingStoreCount,
    in_progress_store_count: inProgressStoreCount
  };
}

export class SqliteReportRepository implements ReportRepository {
  publishReport(payload: ReportPublishPayload, _context: RequestContext = {}): PublishReceipt {
    const receivedAt = new Date().toISOString();
    const normalized = normalizePublishedReport(payload);

    const existingByPublishId = db
      .select({
        id: reportTable.id,
        publishId: reportTable.publishId,
        reportVersion: reportTable.reportVersion
      })
      .from(reportTable)
      .where(eq(reportTable.publishId, normalized.publishId))
      .get();

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

    const existingByVersion = db
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
      )
      .get();

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

    const reportId = db.transaction((tx) => {
      const inserted = tx
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
        .returning({ id: reportTable.id })
        .get();

      tx
        .insert(reportSourceSnapshotTable)
        .values({
          reportId: inserted.id,
          sourceSystem: normalized.sourceSystem,
          payloadVersion: normalized.payloadVersion,
          payloadHash: normalized.payloadHash,
          payloadJson: safeStringify(normalized.rawPayload),
          publishedAt: normalized.publishedAt,
          receivedAt
        })
        .run();

      normalized.stores.forEach((store, index) => {
        tx
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
          })
          .run();
      });

      const resultMap = new Map<string, number>();
      normalized.images.forEach((image, index) => {
        const insertedResult = tx
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
          .returning({ id: reportImageTable.id })
          .get();

        const captureId = readMetadataString(image.metadata, "capture_id");
        const imageExternalId = readMetadataString(image.metadata, "image_id");
        if (captureId) {
          resultMap.set(`capture:${captureId}`, insertedResult.id);
        }
        if (imageExternalId) {
          resultMap.set(`image:${imageExternalId}`, insertedResult.id);
        }
      });

      normalized.issues.forEach((issue, index) => {
        const captureId = readMetadataString(issue.metadata, "capture_id");
        const imageExternalId = readMetadataString(issue.metadata, "image_id");
        const resultId = resultMap.get(`capture:${captureId}`) ?? resultMap.get(`image:${imageExternalId}`) ?? null;

        tx
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
          })
          .run();
      });

      normalized.inspections.forEach((inspection, index) => {
        const captureId = readMetadataString(inspection.metadata, "capture_id");
        const imageExternalId = readMetadataString(inspection.metadata, "image_id");
        const resultId = resultMap.get(`capture:${captureId}`) ?? resultMap.get(`image:${imageExternalId}`) ?? null;

        tx
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
          })
          .run();
      });

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

  getPublishStatus(publishId: string, _context: RequestContext = {}): PublishStatusReceipt {
    const receivedAt = new Date().toISOString();
    const row = db
      .select({
        id: reportTable.id,
        publishId: reportTable.publishId,
        reportVersion: reportTable.reportVersion
      })
      .from(reportTable)
      .where(eq(reportTable.publishId, publishId))
      .get();

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

  listReports(filters: ReportFilters = {}, context: RequestContext = {}): ReportSummary[] {
    const whereClauses = [];
    if (filters.enterprise) {
      whereClauses.push(
        or(
          like(reportTable.enterpriseName, `%${filters.enterprise}%`),
          like(reportTable.sourceEnterpriseId, `%${filters.enterprise}%`)
        )
      );
    }
    if (filters.publishId) {
      whereClauses.push(like(reportTable.publishId, `%${filters.publishId}%`));
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

    const whereCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const summaries = db
      .select()
      .from(reportTable)
      .where(whereCondition)
      .orderBy(desc(reportTable.publishedAt), desc(reportTable.id))
      .all()
      .map(toReportSummary);

    const enterpriseScoped = summaries.filter((summary) => canAccessEnterprise(context, summary.source_enterprise_id));
    const scopedStoreIds = resolveScopedStoreIds(context);
    if (!scopedStoreIds) {
      return enterpriseScoped;
    }
    if (scopedStoreIds.length === 0) {
      return [];
    }

    const reportIds = enterpriseScoped.map((summary) => summary.id);
    if (reportIds.length === 0) {
      return [];
    }
    const visibleReportIds = new Set(
      db
        .select({ reportId: reportStoreTable.reportId })
        .from(reportStoreTable)
        .where(and(inArray(reportStoreTable.reportId, reportIds), inArray(reportStoreTable.storeId, scopedStoreIds)))
        .all()
        .map((row) => row.reportId)
    );

    return enterpriseScoped.filter((summary) => visibleReportIds.has(summary.id));
  }

  getReportDetail(reportId: number, context: RequestContext = {}): ReportDetail | null {
    const reportRow = db.select().from(reportTable).where(eq(reportTable.id, reportId)).get();

    if (!reportRow) {
      return null;
    }

    if (!canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return null;
    }

    const stores = db
      .select()
      .from(reportStoreTable)
      .where(eq(reportStoreTable.reportId, reportId))
      .orderBy(reportStoreTable.displayOrder, reportStoreTable.id)
      .all()
      .map(toReportStore);

    const results = db
      .select()
      .from(reportImageTable)
      .where(eq(reportImageTable.reportId, reportId))
      .orderBy(reportImageTable.displayOrder, reportImageTable.id)
      .all()
      .map(toReportResult);

    const issues = db
      .select()
      .from(reportIssueTable)
      .where(eq(reportIssueTable.reportId, reportId))
      .orderBy(reportIssueTable.displayOrder, reportIssueTable.id)
      .all()
      .map(toReportIssue);

    const inspections = db
      .select()
      .from(reportInspectionTable)
      .where(eq(reportInspectionTable.reportId, reportId))
      .orderBy(reportInspectionTable.displayOrder, reportInspectionTable.id)
      .all()
      .map(toReportInspection);

    const reviewLogs = db
      .select()
      .from(reportReviewLogTable)
      .where(eq(reportReviewLogTable.reportId, reportId))
      .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
      .limit(20)
      .all()
      .map(toReportReviewLog);

    const snapshotRow = db
      .select()
      .from(reportSourceSnapshotTable)
      .where(eq(reportSourceSnapshotTable.reportId, reportId))
      .get();

    const scopedStoreIds = resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    const visibleStores = filterStoresByScope(stores, scopedStoreIds);
    const visibleResults = filterResultsByScope(results, scopedStoreIds);
    const visibleIssues = filterIssuesByScope(issues, scopedStoreIds);
    const visibleInspections = filterInspectionsByScope(inspections, scopedStoreIds);
    const visibleLogs = filterLogsByScope(reviewLogs, scopedStoreIds);

    if (
      scopedStoreIds &&
      visibleStores.length === 0 &&
      visibleResults.length === 0 &&
      visibleIssues.length === 0 &&
      visibleInspections.length === 0
    ) {
      return null;
    }

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
      review_logs: visibleLogs,
      raw_payload: safeParse(snapshotRow?.payloadJson || "{}", {}) as unknown as ReportPublishPayload
    };
  }

  updateImageReviewStatus(
    reportId: number,
    imageId: number,
    reviewStatus: ResultReviewState,
    operatorName: string,
    note = "",
    selectedIssues: ReviewSelectedIssue[] = [],
    context: RequestContext = {}
  ): ReviewResultUpdateResult | null {
    const normalizedReviewState = normalizeResultReviewState(reviewStatus);
    const normalizedOperator = operatorName.trim();
    const normalizedNote = note.trim();
    const normalizedSelectedIssues = normalizeSelectedIssues(selectedIssues);

    return db.transaction((tx) => {
      const reportRow = tx
        .select({
          id: reportTable.id,
          sourceEnterpriseId: reportTable.sourceEnterpriseId,
          progressState: reportTable.progressState,
          completedResultCount: reportTable.completedResultCount,
          totalResultCount: reportTable.totalResultCount
        })
        .from(reportTable)
        .where(eq(reportTable.id, reportId))
        .get();
      if (!reportRow || !canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
        return null;
      }

      const resultRow = tx
        .select()
        .from(reportImageTable)
        .where(and(eq(reportImageTable.reportId, reportId), eq(reportImageTable.id, imageId)))
        .get();
      if (!resultRow) {
        return null;
      }
      const scopedStoreIds = resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
      if (scopedStoreIds) {
        const resultStoreId = String(resultRow.storeId || "").trim();
        if (!resultStoreId || !scopedStoreIds.includes(resultStoreId)) {
          return null;
        }
      }

      const fromState = (resultRow.reviewState as ResultReviewState) || "pending";
      if (fromState === normalizedReviewState && !normalizedNote && normalizedSelectedIssues.length === 0) {
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
      tx
        .update(reportImageTable)
        .set({
          reviewState: normalizedReviewState,
          reviewedBy: normalizedReviewState === "completed" ? normalizedOperator : null,
          reviewedAt,
          reviewNote: normalizedNote || null,
          reviewPayloadJson: safeStringify({
            note: normalizedNote || null,
            updated_by: normalizedOperator,
            updated_at: reviewedAt,
            state: normalizedReviewState,
            selected_issues: normalizedSelectedIssues
          })
        })
        .where(eq(reportImageTable.id, imageId))
        .run();

      tx
        .update(reportIssueTable)
        .set({ reviewState: normalizedReviewState })
        .where(and(eq(reportIssueTable.reportId, reportId), eq(reportIssueTable.resultId, imageId)))
        .run();

      const allResults = tx
        .select({
          id: reportImageTable.id,
          storeId: reportImageTable.storeId,
          reviewState: reportImageTable.reviewState
        })
        .from(reportImageTable)
        .where(eq(reportImageTable.reportId, reportId))
        .all();

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

      resultStatesByStore.forEach((states, storeId) => {
        const completedCount = states.filter((state) => state === "completed").length;
        const progress = buildProgressSummary(states.length, completedCount);
        if (progress.progress_state === "completed") {
          completedStoreCount += 1;
        } else if (progress.progress_state === "in_progress") {
          inProgressStoreCount += 1;
        } else {
          pendingStoreCount += 1;
        }

        tx
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
          .where(and(eq(reportStoreTable.reportId, reportId), eq(reportStoreTable.storeId, storeId)))
          .run();
      });

      const completedResultCount = allResults.filter((row) => row.reviewState === "completed").length;
      const reportProgress = buildProgressSummary(allResults.length, completedResultCount);
      tx
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
        .where(eq(reportTable.id, reportId))
        .run();

      const logRow = tx
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
          metadataJson: safeStringify({
            report_progress_state: reportProgress.progress_state,
            completed_result_count: reportProgress.completed_result_count,
            total_result_count: reportProgress.total_result_count,
            result_id: imageId,
            report_id: reportId,
            selected_issues: normalizedSelectedIssues
          })
        })
        .returning({ id: reportReviewLogTable.id })
        .get();

      const recentLogRow = tx
        .select()
        .from(reportReviewLogTable)
        .where(eq(reportReviewLogTable.id, logRow.id))
        .get();

      const updatedResultRow = tx
        .select()
        .from(reportImageTable)
        .where(eq(reportImageTable.id, imageId))
        .get();

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

  listReviewLogs(reportId: number, limit = 20, imageId?: number, context: RequestContext = {}): ReportReviewLog[] {
    const reportRow = db
      .select({ sourceEnterpriseId: reportTable.sourceEnterpriseId })
      .from(reportTable)
      .where(eq(reportTable.id, reportId))
      .get();
    if (!reportRow || !canAccessEnterprise(context, reportRow.sourceEnterpriseId)) {
      return [];
    }
    const query = db
      .select()
      .from(reportReviewLogTable)
      .where(
        imageId && imageId > 0
          ? and(eq(reportReviewLogTable.reportId, reportId), eq(reportReviewLogTable.resultId, imageId))
          : eq(reportReviewLogTable.reportId, reportId)
      )
      .orderBy(desc(reportReviewLogTable.createdAt), desc(reportReviewLogTable.id))
      .limit(Math.min(Math.max(1, Math.trunc(limit)), 100))
      .all();

    const scopedStoreIds = resolveScopedStoreIds(context, reportRow.sourceEnterpriseId);
    return filterLogsByScope(query.map(toReportReviewLog), scopedStoreIds);
  }
}
