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
  replaceResultFacts(rows: Array<typeof analyticsResultFactTable.$inferInsert>): any;
  replaceIssueFacts(rows: Array<typeof analyticsIssueFactTable.$inferInsert>): any;
  replaceReviewFacts(rows: Array<typeof analyticsReviewFactTable.$inferInsert>): any;
  replaceRectificationFacts(rows: Array<typeof analyticsRectificationFactTable.$inferInsert>): any;
  listResultFacts(): any;
  listIssueFacts(): any;
  listReviewFacts(): any;
  listRectificationFacts(): any;
}
