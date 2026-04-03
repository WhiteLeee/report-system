import { db } from "@/backend/database/client";
import {
  reportImageTable,
  reportInspectionTable,
  reportIssueTable,
  reportRectificationOrderTable,
  reportReviewLogTable,
  reportStoreTable,
  reportTable
} from "@/backend/database/schema";
import {
  buildAnalyticsIssueFact,
  buildAnalyticsRectificationFact,
  buildAnalyticsResultFact,
  buildAnalyticsReviewFact
} from "@/backend/analytics/adapters/report-analytics.adapter";
import type { AnalyticsFactRepository } from "@/backend/analytics/facts/analytics-fact.repository";

function safeParseRecord(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export class AnalyticsFactService {
  constructor(private readonly repository: AnalyticsFactRepository) {}

  rebuildAllFacts(): {
    result_row_count: number;
    issue_row_count: number;
    review_row_count: number;
    rectification_row_count: number;
  } {
    const reportRows = db.select().from(reportTable).all();
    const storeRows = db.select().from(reportStoreTable).all();
    const resultRows = db.select().from(reportImageTable).all();
    const issueRows = db.select().from(reportIssueTable).all();
    const inspectionRows = db.select().from(reportInspectionTable).all();
    const reviewLogRows = db.select().from(reportReviewLogTable).all();
    const rectificationRows = db.select().from(reportRectificationOrderTable).all();

    const reportMap = new Map<number, (typeof reportTable.$inferSelect)>(reportRows.map((row) => [row.id, row] as const));
    const storeMap = new Map<
      string,
      {
        reportId: number;
        storeId: string;
        storeName: string;
        organizationCode: string | null;
        organizationName: string | null;
        franchiseeName: string | null;
      }
    >(
      storeRows.map((row) => {
        const metadata = safeParseRecord(row.metadataJson);
        return [
          `${row.reportId}:${row.storeId}`,
          {
            reportId: row.reportId,
            storeId: row.storeId,
            storeName: row.storeName,
            organizationCode: readString(metadata, "organize_code"),
            organizationName: row.organizationName,
            franchiseeName: readString(metadata, "franchisee_name")
          }
        ] as const;
      })
    );
    const issueMap = new Map<number, Array<(typeof reportIssueTable)["$inferSelect"]>>();
    const inspectionMap = new Map<number, Array<(typeof reportInspectionTable)["$inferSelect"]>>();

    issueRows.forEach((row) => {
      if (!row.resultId) {
        return;
      }
      const bucket = issueMap.get(row.resultId) || [];
      bucket.push(row);
      issueMap.set(row.resultId, bucket);
    });
    inspectionRows.forEach((row) => {
      if (!row.resultId) {
        return;
      }
      const bucket = inspectionMap.get(row.resultId) || [];
      bucket.push(row);
      inspectionMap.set(row.resultId, bucket);
    });

    const resultFactRows = resultRows
      .map((resultRow) => {
        const reportRow = reportMap.get(resultRow.reportId);
        if (!reportRow) {
          return null;
        }
        const storeKey = `${resultRow.reportId}:${String(resultRow.storeId || "")}`;
        return buildAnalyticsResultFact({
          reportRow,
          resultRow,
          storeRow: resultRow.storeId ? storeMap.get(storeKey) || null : null,
          issueRows: issueMap.get(resultRow.id) || [],
          inspectionRows: inspectionMap.get(resultRow.id) || []
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const issueFactRows = issueRows
      .map((issueRow) => {
        const reportRow = reportMap.get(issueRow.reportId);
        if (!reportRow) {
          return null;
        }
        const storeKey = `${issueRow.reportId}:${String(issueRow.storeId || "")}`;
        return buildAnalyticsIssueFact({
          reportRow,
          issueRow,
          storeRow: issueRow.storeId ? storeMap.get(storeKey) || null : null
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const reviewFactRows = reviewLogRows
      .map((reviewLogRow) => {
        const reportRow = reportMap.get(reviewLogRow.reportId);
        if (!reportRow) {
          return null;
        }
        const storeKey = `${reviewLogRow.reportId}:${String(reviewLogRow.storeId || "")}`;
        return buildAnalyticsReviewFact({
          reportRow,
          reviewLogRow,
          storeRow: reviewLogRow.storeId ? storeMap.get(storeKey) || null : null
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const rectificationFactRows = rectificationRows
      .map((rectificationRow) => {
        const reportRow = reportMap.get(rectificationRow.reportId);
        if (!reportRow) {
          return null;
        }
        const storeKey = `${rectificationRow.reportId}:${String(rectificationRow.storeId || "")}`;
        return buildAnalyticsRectificationFact({
          reportRow,
          rectificationRow,
          storeRow: rectificationRow.storeId ? storeMap.get(storeKey) || null : null
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return {
      result_row_count: this.repository.replaceResultFacts(resultFactRows),
      issue_row_count: this.repository.replaceIssueFacts(issueFactRows),
      review_row_count: this.repository.replaceReviewFacts(reviewFactRows),
      rectification_row_count: this.repository.replaceRectificationFacts(rectificationFactRows)
    };
  }

  rebuildAllResultFacts(): {
    result_row_count: number;
    issue_row_count: number;
    review_row_count: number;
    rectification_row_count: number;
  } {
    return this.rebuildAllFacts();
  }
}
