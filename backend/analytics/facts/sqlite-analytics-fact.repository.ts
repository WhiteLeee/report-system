import { asc } from "drizzle-orm";

import { db } from "@/backend/database/client";
import {
  analyticsIssueFactTable,
  analyticsRectificationFactTable,
  analyticsResultFactTable,
  analyticsReviewFactTable
} from "@/backend/database/schema";
import type {
  AnalyticsIssueFactRecord,
  AnalyticsRectificationFactRecord,
  AnalyticsResultFactRecord,
  AnalyticsReviewFactRecord
} from "@/backend/analytics/facts/analytics-fact.types";
import type { AnalyticsFactRepository } from "@/backend/analytics/facts/analytics-fact.repository";

function safeParseRecord(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toAnalyticsResultFactRecord(row: typeof analyticsResultFactTable.$inferSelect): AnalyticsResultFactRecord {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
    report_topic: row.reportTopic,
    plan_id: row.planId,
    plan_name: row.planName,
    report_version: row.reportVersion,
    store_id: row.storeId,
    store_name: row.storeName,
    organization_code: row.organizationCode,
    organization_name: row.organizationName,
    franchisee_name: row.franchiseeName,
    published_date: row.publishedDate,
    captured_date: row.capturedDate,
    result_semantic_state: row.resultSemanticState,
    issue_count: row.issueCount,
    review_state: row.reviewState,
    auto_completed: row.autoCompleted === 1,
    rectification_required: row.rectificationRequired === 1,
    source_snapshot_version: row.sourceSnapshotVersion,
    analytics_schema_version: row.analyticsSchemaVersion,
    source_payload: safeParseRecord(row.sourcePayloadJson),
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toAnalyticsIssueFactRecord(row: typeof analyticsIssueFactTable.$inferSelect): AnalyticsIssueFactRecord {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    issue_id: row.issueId,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
    report_topic: row.reportTopic,
    plan_id: row.planId,
    plan_name: row.planName,
    report_version: row.reportVersion,
    store_id: row.storeId,
    store_name: row.storeName,
    organization_code: row.organizationCode,
    organization_name: row.organizationName,
    franchisee_name: row.franchiseeName,
    published_date: row.publishedDate,
    skill_id: row.skillId,
    skill_name: row.skillName,
    issue_type: row.issueType,
    severity: row.severity,
    title: row.title,
    analytics_schema_version: row.analyticsSchemaVersion,
    source_payload: safeParseRecord(row.sourcePayloadJson),
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toAnalyticsReviewFactRecord(row: typeof analyticsReviewFactTable.$inferSelect): AnalyticsReviewFactRecord {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    review_log_id: row.reviewLogId,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
    report_topic: row.reportTopic,
    plan_id: row.planId,
    plan_name: row.planName,
    report_version: row.reportVersion,
    store_id: row.storeId,
    store_name: row.storeName,
    organization_code: row.organizationCode,
    organization_name: row.organizationName,
    franchisee_name: row.franchiseeName,
    published_date: row.publishedDate,
    review_date: row.reviewDate,
    from_status: row.fromStatus,
    to_status: row.toStatus,
    operator_name: row.operatorName,
    review_action: row.reviewAction,
    review_latency_minutes: row.reviewLatencyMinutes,
    note_length: row.noteLength,
    analytics_schema_version: row.analyticsSchemaVersion,
    source_payload: safeParseRecord(row.sourcePayloadJson),
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toAnalyticsRectificationFactRecord(
  row: typeof analyticsRectificationFactTable.$inferSelect
): AnalyticsRectificationFactRecord {
  return {
    id: row.id,
    order_id: row.orderId,
    report_id: row.reportId,
    result_id: row.resultId,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_type: row.reportType,
    report_topic: row.reportTopic,
    plan_id: row.planId,
    plan_name: row.planName,
    report_version: row.reportVersion,
    store_id: row.storeId,
    store_code: row.storeCode,
    store_name: row.storeName,
    organization_code: row.organizationCode,
    organization_name: row.organizationName,
    franchisee_name: row.franchiseeName,
    published_date: row.publishedDate,
    created_date: row.createdDate,
    should_corrected_date: row.shouldCorrectedDate,
    completed_date: row.completedDate,
    local_status: row.localStatus,
    remote_if_corrected: row.remoteIfCorrected,
    sync_failed: row.syncFailed === 1,
    overdue: row.overdue === 1,
    analytics_schema_version: row.analyticsSchemaVersion,
    source_payload: safeParseRecord(row.sourcePayloadJson),
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

export class SqliteAnalyticsFactRepository implements AnalyticsFactRepository {
  replaceResultFacts(rows: Array<typeof analyticsResultFactTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsResultFactTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsResultFactTable).values(rows).run();
      return rows.length;
    });
  }

  replaceIssueFacts(rows: Array<typeof analyticsIssueFactTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsIssueFactTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsIssueFactTable).values(rows).run();
      return rows.length;
    });
  }

  replaceReviewFacts(rows: Array<typeof analyticsReviewFactTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsReviewFactTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsReviewFactTable).values(rows).run();
      return rows.length;
    });
  }

  replaceRectificationFacts(rows: Array<typeof analyticsRectificationFactTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsRectificationFactTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsRectificationFactTable).values(rows).run();
      return rows.length;
    });
  }

  listResultFacts(): AnalyticsResultFactRecord[] {
    return db.select().from(analyticsResultFactTable).orderBy(asc(analyticsResultFactTable.id)).all().map(toAnalyticsResultFactRecord);
  }

  listIssueFacts(): AnalyticsIssueFactRecord[] {
    return db.select().from(analyticsIssueFactTable).orderBy(asc(analyticsIssueFactTable.id)).all().map(toAnalyticsIssueFactRecord);
  }

  listReviewFacts(): AnalyticsReviewFactRecord[] {
    return db.select().from(analyticsReviewFactTable).orderBy(asc(analyticsReviewFactTable.id)).all().map(toAnalyticsReviewFactRecord);
  }

  listRectificationFacts(): AnalyticsRectificationFactRecord[] {
    return db
      .select()
      .from(analyticsRectificationFactTable)
      .orderBy(asc(analyticsRectificationFactTable.id))
      .all()
      .map(toAnalyticsRectificationFactRecord);
  }
}
