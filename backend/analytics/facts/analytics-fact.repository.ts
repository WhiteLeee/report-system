import type {
  AnalyticsIssueFactRecord,
  AnalyticsRectificationFactRecord,
  AnalyticsResultFactRecord,
  AnalyticsReviewFactRecord
} from "@/backend/analytics/facts/analytics-fact.types";
import type {
  analyticsIssueFactTable,
  analyticsRectificationFactTable,
  analyticsResultFactTable,
  analyticsReviewFactTable
} from "@/backend/database/schema";

export interface AnalyticsFactRepository {
  replaceResultFacts(rows: Array<typeof analyticsResultFactTable.$inferInsert>): number;
  replaceIssueFacts(rows: Array<typeof analyticsIssueFactTable.$inferInsert>): number;
  replaceReviewFacts(rows: Array<typeof analyticsReviewFactTable.$inferInsert>): number;
  replaceRectificationFacts(rows: Array<typeof analyticsRectificationFactTable.$inferInsert>): number;
  listResultFacts(): AnalyticsResultFactRecord[];
  listIssueFacts(): AnalyticsIssueFactRecord[];
  listReviewFacts(): AnalyticsReviewFactRecord[];
  listRectificationFacts(): AnalyticsRectificationFactRecord[];
}
