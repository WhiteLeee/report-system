import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const reportTable = sqliteTable(
  "report",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publishId: text("publish_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull(),
    reportType: text("report_type").notNull(),
    reportVersion: text("report_version").notNull(),
    progressState: text("progress_state").notNull().default("pending"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    operatorName: text("operator_name").notNull(),
    storeCount: integer("store_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    issueCount: integer("issue_count").notNull().default(0),
    completedStoreCount: integer("completed_store_count").notNull().default(0),
    pendingStoreCount: integer("pending_store_count").notNull().default(0),
    inProgressStoreCount: integer("in_progress_store_count").notNull().default(0),
    totalResultCount: integer("total_result_count").notNull().default(0),
    completedResultCount: integer("completed_result_count").notNull().default(0),
    pendingResultCount: integer("pending_result_count").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    summaryMetricsJson: text("summary_metrics_json").notNull(),
    stateSnapshotJson: text("state_snapshot_json").notNull().default("{}"),
    extensionsJson: text("extensions_json").notNull().default("{}"),
    publishedAt: text("published_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    publishIdUnique: uniqueIndex("report_publish_id_unique").on(table.publishId),
    reportVersionUnique: uniqueIndex("report_version_unique").on(
      table.sourceEnterpriseId,
      table.reportType,
      table.reportVersion
    ),
    publishedAtIdx: index("idx_report_published_at").on(table.publishedAt),
    enterpriseIdx: index("idx_report_enterprise").on(table.sourceEnterpriseId, table.enterpriseName),
    progressStateIdx: index("idx_report_progress_state").on(table.progressState)
  })
);

export const reportStoreTable = sqliteTable(
  "report_store",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    storeId: text("store_id").notNull(),
    storeName: text("store_name").notNull(),
    organizationName: text("organization_name"),
    progressState: text("progress_state").notNull().default("pending"),
    issueCount: integer("issue_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    totalResultCount: integer("total_result_count").notNull().default(0),
    completedResultCount: integer("completed_result_count").notNull().default(0),
    pendingResultCount: integer("pending_result_count").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    stateSnapshotJson: text("state_snapshot_json").notNull().default("{}"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportStoreUnique: uniqueIndex("report_store_unique").on(table.reportId, table.storeId),
    reportIdx: index("idx_report_store_report").on(table.reportId, table.displayOrder)
  })
);

export const reportImageTable = sqliteTable(
  "report_image",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    storeId: text("store_id"),
    storeName: text("store_name"),
    objectKey: text("object_key"),
    bucket: text("bucket"),
    region: text("region"),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    capturedAt: text("captured_at"),
    reviewState: text("review_state").notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note"),
    reviewPayloadJson: text("review_payload_json").notNull().default("{}"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportIdx: index("idx_report_image_report").on(table.reportId, table.displayOrder)
  })
);

export const reportIssueTable = sqliteTable(
  "report_issue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id").references(() => reportImageTable.id, { onDelete: "set null" }),
    storeId: text("store_id"),
    storeName: text("store_name"),
    title: text("title").notNull(),
    category: text("category"),
    severity: text("severity"),
    description: text("description"),
    suggestion: text("suggestion"),
    imageUrl: text("image_url"),
    imageObjectKey: text("image_object_key"),
    reviewState: text("review_state").notNull().default("pending"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportIdx: index("idx_report_issue_report").on(table.reportId, table.displayOrder)
  })
);

export const reportInspectionTable = sqliteTable(
  "report_inspection",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id").references(() => reportImageTable.id, { onDelete: "set null" }),
    storeId: text("store_id"),
    storeName: text("store_name"),
    inspectionId: text("inspection_id").notNull(),
    skillId: text("skill_id").notNull(),
    skillName: text("skill_name"),
    status: text("status"),
    rawResult: text("raw_result"),
    errorMessage: text("error_message"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportIdx: index("idx_report_inspection_report").on(table.reportId, table.displayOrder),
    resultIdx: index("idx_report_inspection_result").on(table.resultId, table.displayOrder)
  })
);

export const reportReviewLogTable = sqliteTable(
  "report_review_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id").notNull().references(() => reportImageTable.id, { onDelete: "cascade" }),
    storeId: text("store_id"),
    storeName: text("store_name"),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    operatorName: text("operator_name").notNull(),
    note: text("note"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportIdx: index("idx_report_review_log_report").on(table.reportId, table.createdAt, table.id),
    resultIdx: index("idx_report_review_log_result").on(table.resultId, table.createdAt, table.id)
  })
);

export const reportRectificationOrderTable = sqliteTable(
  "report_rectification_order",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id").notNull().references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id").notNull().references(() => reportImageTable.id, { onDelete: "cascade" }),
    sourceReviewLogId: integer("source_review_log_id").references(() => reportReviewLogTable.id, {
      onDelete: "set null"
    }),
    storeId: text("store_id"),
    storeCode: text("store_code"),
    storeName: text("store_name"),
    huiYunYingOrderId: text("huiyunying_order_id"),
    requestDescription: text("request_description").notNull().default(""),
    selectedIssuesJson: text("selected_issues_json").notNull().default("[]"),
    imageUrlsJson: text("image_urls_json").notNull().default("[]"),
    requestPayloadJson: text("request_payload_json").notNull().default("{}"),
    responsePayloadJson: text("response_payload_json").notNull().default("{}"),
    status: text("status").notNull().default("created"),
    ifCorrected: text("if_corrected"),
    shouldCorrected: text("should_corrected"),
    realCorrectedTime: text("real_corrected_time"),
    rectificationReplyContent: text("rectification_reply_content"),
    lastSyncedAt: text("last_synced_at"),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    resultIdx: index("idx_report_rectification_order_result").on(table.resultId, table.createdAt),
    reportIdx: index("idx_report_rectification_order_report").on(table.reportId, table.createdAt),
    orderIdx: index("idx_report_rectification_order_hyy").on(table.huiYunYingOrderId, table.updatedAt),
    statusIdx: index("idx_report_rectification_order_status").on(table.status, table.updatedAt)
  })
);

export const reportRectificationSyncBatchTable = sqliteTable(
  "report_rectification_sync_batch",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    syncBatchId: text("sync_batch_id").notNull(),
    triggerSource: text("trigger_source").notNull().default("scheduler"),
    status: text("status").notNull().default("running"),
    scannedCount: integer("scanned_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    notFoundCount: integer("not_found_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    averageResponseTimeMs: integer("average_response_time_ms"),
    maxResponseTimeMs: integer("max_response_time_ms"),
    configJson: text("config_json").notNull().default("{}"),
    summaryJson: text("summary_json").notNull().default("{}"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    syncBatchUnique: uniqueIndex("report_rectification_sync_batch_unique").on(table.syncBatchId),
    startedIdx: index("idx_report_rectification_sync_batch_started").on(table.startedAt),
    statusIdx: index("idx_report_rectification_sync_batch_status").on(table.status, table.startedAt)
  })
);

export const reportRectificationSyncLogTable = sqliteTable(
  "report_rectification_sync_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    syncBatchId: text("sync_batch_id").notNull(),
    orderId: integer("order_id")
      .notNull()
      .references(() => reportRectificationOrderTable.id, { onDelete: "cascade" }),
    huiYunYingOrderId: text("huiyunying_order_id"),
    status: text("status").notNull(),
    errorType: text("error_type"),
    errorMessage: text("error_message").notNull().default(""),
    attemptCount: integer("attempt_count").notNull().default(1),
    responseTimeMs: integer("response_time_ms"),
    remoteStatus: text("remote_status"),
    remoteIfCorrected: text("remote_if_corrected"),
    requestPayloadJson: text("request_payload_json").notNull().default("{}"),
    responsePayloadJson: text("response_payload_json").notNull().default("{}"),
    syncedAt: text("synced_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    batchIdx: index("idx_report_rectification_sync_log_batch").on(table.syncBatchId, table.syncedAt),
    orderIdx: index("idx_report_rectification_sync_log_order").on(table.orderId, table.syncedAt),
    statusIdx: index("idx_report_rectification_sync_log_status").on(table.status, table.syncedAt)
  })
);

export const analyticsResultFactTable = sqliteTable(
  "analytics_result_fact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id")
      .notNull()
      .references(() => reportImageTable.id, { onDelete: "cascade" }),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    reportType: text("report_type").notNull().default(""),
    reportTopic: text("report_topic").notNull().default(""),
    planId: text("plan_id").notNull().default(""),
    planName: text("plan_name").notNull().default(""),
    reportVersion: text("report_version").notNull().default(""),
    storeId: text("store_id"),
    storeName: text("store_name"),
    organizationCode: text("organization_code"),
    organizationName: text("organization_name"),
    franchiseeName: text("franchisee_name"),
    publishedDate: text("published_date").notNull(),
    capturedDate: text("captured_date"),
    resultSemanticState: text("result_semantic_state").notNull(),
    issueCount: integer("issue_count").notNull().default(0),
    reviewState: text("review_state").notNull().default("pending"),
    autoCompleted: integer("auto_completed").notNull().default(0),
    rectificationRequired: integer("rectification_required").notNull().default(0),
    sourceSnapshotVersion: integer("source_snapshot_version").notNull().default(1),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    sourcePayloadJson: text("source_payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    resultUnique: uniqueIndex("analytics_result_fact_result_unique").on(table.resultId),
    reportIdx: index("idx_analytics_result_fact_report").on(table.reportId, table.publishedDate),
    enterpriseIdx: index("idx_analytics_result_fact_enterprise").on(table.sourceEnterpriseId, table.publishedDate),
    semanticIdx: index("idx_analytics_result_fact_semantic").on(table.resultSemanticState, table.publishedDate),
    storeIdx: index("idx_analytics_result_fact_store").on(table.storeId, table.publishedDate)
  })
);

export const analyticsIssueFactTable = sqliteTable(
  "analytics_issue_fact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id")
      .references(() => reportImageTable.id, { onDelete: "cascade" }),
    issueId: integer("issue_id")
      .notNull()
      .references(() => reportIssueTable.id, { onDelete: "cascade" }),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    reportType: text("report_type").notNull().default(""),
    reportTopic: text("report_topic").notNull().default(""),
    planId: text("plan_id").notNull().default(""),
    planName: text("plan_name").notNull().default(""),
    reportVersion: text("report_version").notNull().default(""),
    storeId: text("store_id"),
    storeName: text("store_name"),
    organizationCode: text("organization_code"),
    organizationName: text("organization_name"),
    franchiseeName: text("franchisee_name"),
    publishedDate: text("published_date").notNull(),
    skillId: text("skill_id").notNull().default(""),
    skillName: text("skill_name").notNull().default(""),
    issueType: text("issue_type").notNull().default(""),
    severity: text("severity"),
    title: text("title").notNull().default(""),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    sourcePayloadJson: text("source_payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    issueUnique: uniqueIndex("analytics_issue_fact_issue_unique").on(table.issueId),
    reportIdx: index("idx_analytics_issue_fact_report").on(table.reportId, table.publishedDate),
    enterpriseIdx: index("idx_analytics_issue_fact_enterprise").on(table.sourceEnterpriseId, table.publishedDate),
    storeIdx: index("idx_analytics_issue_fact_store").on(table.storeId, table.publishedDate),
    issueTypeIdx: index("idx_analytics_issue_fact_issue_type").on(table.issueType, table.publishedDate),
    skillIdx: index("idx_analytics_issue_fact_skill").on(table.skillId, table.publishedDate),
    severityIdx: index("idx_analytics_issue_fact_severity").on(table.severity, table.publishedDate)
  })
);

export const analyticsReviewFactTable = sqliteTable(
  "analytics_review_fact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id")
      .notNull()
      .references(() => reportImageTable.id, { onDelete: "cascade" }),
    reviewLogId: integer("review_log_id")
      .notNull()
      .references(() => reportReviewLogTable.id, { onDelete: "cascade" }),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    reportType: text("report_type").notNull().default(""),
    reportTopic: text("report_topic").notNull().default(""),
    planId: text("plan_id").notNull().default(""),
    planName: text("plan_name").notNull().default(""),
    reportVersion: text("report_version").notNull().default(""),
    storeId: text("store_id"),
    storeName: text("store_name"),
    organizationCode: text("organization_code"),
    organizationName: text("organization_name"),
    franchiseeName: text("franchisee_name"),
    publishedDate: text("published_date").notNull(),
    reviewDate: text("review_date").notNull(),
    fromStatus: text("from_status").notNull().default(""),
    toStatus: text("to_status").notNull().default(""),
    operatorName: text("operator_name").notNull().default(""),
    reviewAction: text("review_action").notNull().default("transition"),
    reviewLatencyMinutes: integer("review_latency_minutes").notNull().default(0),
    noteLength: integer("note_length").notNull().default(0),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    sourcePayloadJson: text("source_payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reviewLogUnique: uniqueIndex("analytics_review_fact_review_log_unique").on(table.reviewLogId),
    reportIdx: index("idx_analytics_review_fact_report").on(table.reportId, table.reviewDate),
    enterpriseIdx: index("idx_analytics_review_fact_enterprise").on(table.sourceEnterpriseId, table.reviewDate),
    storeIdx: index("idx_analytics_review_fact_store").on(table.storeId, table.reviewDate),
    actionIdx: index("idx_analytics_review_fact_action").on(table.reviewAction, table.reviewDate)
  })
);

export const analyticsRectificationFactTable = sqliteTable(
  "analytics_rectification_fact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => reportRectificationOrderTable.id, { onDelete: "cascade" }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportTable.id, { onDelete: "cascade" }),
    resultId: integer("result_id")
      .notNull()
      .references(() => reportImageTable.id, { onDelete: "cascade" }),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    reportType: text("report_type").notNull().default(""),
    reportTopic: text("report_topic").notNull().default(""),
    planId: text("plan_id").notNull().default(""),
    planName: text("plan_name").notNull().default(""),
    reportVersion: text("report_version").notNull().default(""),
    storeId: text("store_id"),
    storeCode: text("store_code"),
    storeName: text("store_name"),
    organizationCode: text("organization_code"),
    organizationName: text("organization_name"),
    franchiseeName: text("franchisee_name"),
    publishedDate: text("published_date").notNull(),
    createdDate: text("created_date").notNull(),
    shouldCorrectedDate: text("should_corrected_date"),
    completedDate: text("completed_date"),
    localStatus: text("local_status").notNull().default(""),
    remoteIfCorrected: text("remote_if_corrected"),
    syncFailed: integer("sync_failed").notNull().default(0),
    overdue: integer("overdue").notNull().default(0),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    sourcePayloadJson: text("source_payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    orderUnique: uniqueIndex("analytics_rectification_fact_order_unique").on(table.orderId),
    reportIdx: index("idx_analytics_rectification_fact_report").on(table.reportId, table.createdDate),
    enterpriseIdx: index("idx_analytics_rectification_fact_enterprise").on(table.sourceEnterpriseId, table.createdDate),
    storeIdx: index("idx_analytics_rectification_fact_store").on(table.storeId, table.createdDate),
    overdueIdx: index("idx_analytics_rectification_fact_overdue").on(table.overdue, table.shouldCorrectedDate)
  })
);

export const analyticsDailyOverviewSnapshotTable = sqliteTable(
  "analytics_daily_overview_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotDate: text("snapshot_date").notNull(),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    reportCount: integer("report_count").notNull().default(0),
    storeCount: integer("store_count").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    issueCount: integer("issue_count").notNull().default(0),
    pendingReviewCount: integer("pending_review_count").notNull().default(0),
    completedReviewCount: integer("completed_review_count").notNull().default(0),
    autoCompletedReviewCount: integer("auto_completed_review_count").notNull().default(0),
    manualCompletedReviewCount: integer("manual_completed_review_count").notNull().default(0),
    rectificationOrderCount: integer("rectification_order_count").notNull().default(0),
    rectificationCompletedCount: integer("rectification_completed_count").notNull().default(0),
    rectificationPendingCount: integer("rectification_pending_count").notNull().default(0),
    rectificationOverdueCount: integer("rectification_overdue_count").notNull().default(0),
    rectificationCloseRate: integer("rectification_close_rate").notNull().default(0),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    builtAt: text("built_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    snapshotUnique: uniqueIndex("analytics_daily_overview_snapshot_unique").on(table.snapshotDate, table.sourceEnterpriseId),
    enterpriseIdx: index("idx_analytics_daily_overview_enterprise").on(table.sourceEnterpriseId, table.snapshotDate)
  })
);

export const analyticsDailySemanticSnapshotTable = sqliteTable(
  "analytics_daily_semantic_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotDate: text("snapshot_date").notNull(),
    sourceEnterpriseId: text("source_enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    resultSemanticState: text("result_semantic_state").notNull(),
    resultCount: integer("result_count").notNull().default(0),
    issueCount: integer("issue_count").notNull().default(0),
    analyticsSchemaVersion: integer("analytics_schema_version").notNull().default(1),
    builtAt: text("built_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    snapshotUnique: uniqueIndex("analytics_daily_semantic_snapshot_unique").on(
      table.snapshotDate,
      table.sourceEnterpriseId,
      table.resultSemanticState
    ),
    enterpriseIdx: index("idx_analytics_daily_semantic_enterprise").on(table.sourceEnterpriseId, table.snapshotDate)
  })
);

export const analyticsJobRunTable = sqliteTable(
  "analytics_job_run",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobKey: text("job_key").notNull(),
    jobType: text("job_type").notNull(),
    status: text("status").notNull().default("running"),
    scopeJson: text("scope_json").notNull().default("{}"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    errorMessage: text("error_message").notNull().default(""),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    jobKeyUnique: uniqueIndex("analytics_job_run_key_unique").on(table.jobKey),
    typeIdx: index("idx_analytics_job_run_type").on(table.jobType, table.startedAt),
    statusIdx: index("idx_analytics_job_run_status").on(table.status, table.startedAt)
  })
);

export const analyticsJobCheckpointTable = sqliteTable(
  "analytics_job_checkpoint",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobType: text("job_type").notNull(),
    scopeKey: text("scope_key").notNull().default("global"),
    checkpointJson: text("checkpoint_json").notNull().default("{}"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    jobScopeUnique: uniqueIndex("analytics_job_checkpoint_unique").on(table.jobType, table.scopeKey)
  })
);

export const reportSourceSnapshotTable = sqliteTable(
  "report_source_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportTable.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    payloadVersion: integer("payload_version").notNull(),
    payloadHash: text("payload_hash").notNull(),
    payloadJson: text("payload_json").notNull(),
    publishedAt: text("published_at").notNull(),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    reportUnique: uniqueIndex("report_source_snapshot_report_unique").on(table.reportId),
    sourceIdx: index("idx_report_source_snapshot_source").on(table.sourceSystem, table.publishedAt)
  })
);

export const organizationMasterTable = sqliteTable(
  "organization_master",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    enterpriseId: text("enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    organizeCode: text("organize_code").notNull(),
    organizeName: text("organize_name").notNull(),
    parentCode: text("parent_code").notNull().default(""),
    level: integer("level").notNull().default(0),
    rawJson: text("raw_json").notNull().default("{}"),
    isActive: integer("is_active").notNull().default(1),
    snapshotVersion: text("snapshot_version").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    enterpriseCodeUnique: uniqueIndex("organization_master_enterprise_code_unique").on(table.enterpriseId, table.organizeCode),
    enterpriseParentIdx: index("idx_organization_master_enterprise_parent").on(table.enterpriseId, table.parentCode, table.isActive),
    enterpriseActiveIdx: index("idx_organization_master_enterprise_active").on(table.enterpriseId, table.isActive, table.organizeName)
  })
);

export const storeMasterProfileTable = sqliteTable(
  "store_master_profile",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    enterpriseId: text("enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    storeId: text("store_id").notNull(),
    storeCode: text("store_code").notNull().default(""),
    storeName: text("store_name").notNull(),
    organizeCode: text("organize_code").notNull().default(""),
    organizeName: text("organize_name").notNull().default(""),
    storeType: text("store_type").notNull().default(""),
    franchiseeName: text("franchisee_name").notNull().default(""),
    supervisor: text("supervisor").notNull().default(""),
    status: text("status").notNull().default(""),
    rawJson: text("raw_json").notNull().default("{}"),
    isActive: integer("is_active").notNull().default(1),
    snapshotVersion: text("snapshot_version").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    enterpriseStoreUnique: uniqueIndex("store_master_profile_enterprise_store_unique").on(table.enterpriseId, table.storeId),
    enterpriseStoreCodeIdx: index("idx_store_master_profile_enterprise_code").on(table.enterpriseId, table.storeCode),
    enterpriseOrgIdx: index("idx_store_master_profile_enterprise_org").on(table.enterpriseId, table.organizeCode, table.isActive),
    enterpriseStatusIdx: index("idx_store_master_profile_enterprise_status").on(table.enterpriseId, table.status, table.isActive),
    enterpriseNameIdx: index("idx_store_master_profile_enterprise_name").on(table.enterpriseId, table.storeName)
  })
);

export const masterDataSyncLogTable = sqliteTable(
  "master_data_sync_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    syncBatchId: text("sync_batch_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    sourceSystem: text("source_system").notNull(),
    enterpriseId: text("enterprise_id").notNull(),
    enterpriseName: text("enterprise_name").notNull().default(""),
    dataType: text("data_type").notNull(),
    snapshotVersion: text("snapshot_version").notNull().default(""),
    snapshotMode: text("snapshot_mode").notNull().default("full_replace"),
    organizeCount: integer("organize_count").notNull().default(0),
    storeCount: integer("store_count").notNull().default(0),
    status: text("status").notNull().default("published"),
    requestPayloadJson: text("request_payload_json").notNull().default("{}"),
    errorMessage: text("error_message").notNull().default(""),
    publishedAt: text("published_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    syncBatchUnique: uniqueIndex("master_data_sync_log_sync_batch_unique").on(table.syncBatchId),
    idempotencyUnique: uniqueIndex("master_data_sync_log_idempotency_unique").on(table.idempotencyKey),
    enterpriseIdx: index("idx_master_data_sync_log_enterprise").on(table.enterpriseId, table.createdAt),
    statusIdx: index("idx_master_data_sync_log_status").on(table.status, table.createdAt)
  })
);

export const systemSettingTable = sqliteTable(
  "system_setting",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    settingKey: text("setting_key").notNull(),
    category: text("category").notNull().default("general"),
    valueJson: text("value_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    settingKeyUnique: uniqueIndex("system_setting_key_unique").on(table.settingKey),
    categoryIdx: index("idx_system_setting_category").on(table.category, table.settingKey)
  })
);

export const reportUserTable = sqliteTable(
  "report_user",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    usernameUnique: uniqueIndex("report_user_username_unique").on(table.username),
    statusIdx: index("idx_report_user_status").on(table.status)
  })
);

export const reportRoleTable = sqliteTable(
  "report_role",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    codeUnique: uniqueIndex("report_role_code_unique").on(table.code)
  })
);

export const reportPermissionTable = sqliteTable(
  "report_permission",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    codeUnique: uniqueIndex("report_permission_code_unique").on(table.code)
  })
);

export const reportUserRoleTable = sqliteTable(
  "report_user_role",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => reportUserTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => reportRoleTable.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    userRoleUnique: uniqueIndex("report_user_role_unique").on(table.userId, table.roleId),
    roleIdx: index("idx_report_user_role_role").on(table.roleId)
  })
);

export const reportRolePermissionTable = sqliteTable(
  "report_role_permission",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roleId: integer("role_id")
      .notNull()
      .references(() => reportRoleTable.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => reportPermissionTable.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("report_role_permission_unique").on(table.roleId, table.permissionId),
    permissionIdx: index("idx_report_role_permission_permission").on(table.permissionId)
  })
);

export const reportSessionTable = sqliteTable(
  "report_session",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => reportUserTable.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    tokenUnique: uniqueIndex("report_session_token_hash_unique").on(table.sessionTokenHash),
    userIdx: index("idx_report_session_user").on(table.userId, table.expiresAt)
  })
);

export const reportUserScopeTable = sqliteTable(
  "report_user_scope",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => reportUserTable.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeValue: text("scope_value").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    userScopeUnique: uniqueIndex("report_user_scope_unique").on(table.userId, table.scopeType, table.scopeValue),
    userScopeIdx: index("idx_report_user_scope_user_type").on(table.userId, table.scopeType)
  })
);
