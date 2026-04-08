import type { RequestContext } from "@/backend/auth/request-context";
import { normalizeAnalyticsFilters, type AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import type { AnalyticsDashboard, AnalyticsFilterOptions } from "@/backend/analytics/contracts/analytics.types";
import type { AnalyticsRepository } from "@/backend/analytics/queries/analytics.repository";

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  getDashboard(filters: AnalyticsFilters = {}, context: RequestContext = {}, issueTypeLimit?: number): AnalyticsDashboard {
    return this.repository.getDashboard(normalizeAnalyticsFilters(filters), context, issueTypeLimit);
  }

  getFilterOptions(filters: AnalyticsFilters = {}, context: RequestContext = {}): AnalyticsFilterOptions {
    return this.repository.getFilterOptions(normalizeAnalyticsFilters(filters), context);
  }
}
