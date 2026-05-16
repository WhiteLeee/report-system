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

function safeParseRecord(json: string): any {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toAnalyticsResultFactRecord(row: typeof analyticsResultFactTable.$inferSelect): any {
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

function toAnalyticsIssueFactRecord(row: typeof analyticsIssueFactTable.$inferSelect): any {
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

function toAnalyticsReviewFactRecord(row: typeof analyticsReviewFactTable.$inferSelect): any {
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
    review_disposition: row.reviewDisposition,
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
): any {
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

export class PgAnalyticsFactRepository implements AnalyticsFactRepository {
  private static readonly INSERT_BATCH_SIZE = 20;

  private async insertResultFactsInBatches(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    rows: Array<typeof analyticsResultFactTable.$inferInsert>
  ): Promise<any> {
    for (let index = 0; index < rows.length; index += PgAnalyticsFactRepository.INSERT_BATCH_SIZE) {
      await tx.insert(analyticsResultFactTable)
                .values(rows.slice(index, index + PgAnalyticsFactRepository.INSERT_BATCH_SIZE));
    }
  }

  private async insertIssueFactsInBatches(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    rows: Array<typeof analyticsIssueFactTable.$inferInsert>
  ): Promise<any> {
    for (let index = 0; index < rows.length; index += PgAnalyticsFactRepository.INSERT_BATCH_SIZE) {
      await tx.insert(analyticsIssueFactTable)
                .values(rows.slice(index, index + PgAnalyticsFactRepository.INSERT_BATCH_SIZE));
    }
  }

  private async insertReviewFactsInBatches(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    rows: Array<typeof analyticsReviewFactTable.$inferInsert>
  ): Promise<any> {
    for (let index = 0; index < rows.length; index += PgAnalyticsFactRepository.INSERT_BATCH_SIZE) {
      await tx.insert(analyticsReviewFactTable)
                .values(rows.slice(index, index + PgAnalyticsFactRepository.INSERT_BATCH_SIZE));
    }
  }

  private async insertRectificationFactsInBatches(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    rows: Array<typeof analyticsRectificationFactTable.$inferInsert>
  ): Promise<any> {
    for (let index = 0; index < rows.length; index += PgAnalyticsFactRepository.INSERT_BATCH_SIZE) {
      await tx.insert(analyticsRectificationFactTable)
                .values(rows.slice(index, index + PgAnalyticsFactRepository.INSERT_BATCH_SIZE));
    }
  }

  replaceResultFacts(rows: Array<typeof analyticsResultFactTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsResultFactTable);
      if (rows.length === 0) {
        return 0;
      }
      await this.insertResultFactsInBatches(tx, rows);
      return rows.length;
    });
  }

  replaceIssueFacts(rows: Array<typeof analyticsIssueFactTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsIssueFactTable);
      if (rows.length === 0) {
        return 0;
      }
      await this.insertIssueFactsInBatches(tx, rows);
      return rows.length;
    });
  }

  replaceReviewFacts(rows: Array<typeof analyticsReviewFactTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsReviewFactTable);
      if (rows.length === 0) {
        return 0;
      }
      await this.insertReviewFactsInBatches(tx, rows);
      return rows.length;
    });
  }

  replaceRectificationFacts(rows: Array<typeof analyticsRectificationFactTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsRectificationFactTable);
      if (rows.length === 0) {
        return 0;
      }
      await this.insertRectificationFactsInBatches(tx, rows);
      return rows.length;
    });
  }

  async listResultFacts(): Promise<any> {
    return (await db.select().from(analyticsResultFactTable).orderBy(asc(analyticsResultFactTable.id))).map(toAnalyticsResultFactRecord);
  }

  async listIssueFacts(): Promise<any> {
    return (await db.select().from(analyticsIssueFactTable).orderBy(asc(analyticsIssueFactTable.id))).map(toAnalyticsIssueFactRecord);
  }

  async listReviewFacts(): Promise<any> {
    return (await db.select().from(analyticsReviewFactTable).orderBy(asc(analyticsReviewFactTable.id))).map(toAnalyticsReviewFactRecord);
  }

  async listRectificationFacts(): Promise<any> {
    return (await db
          .select()
          .from(analyticsRectificationFactTable)
          .orderBy(asc(analyticsRectificationFactTable.id)))
      .map(toAnalyticsRectificationFactRecord);
  }
}
