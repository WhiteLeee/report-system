import type { RequestContext } from "@/backend/auth/request-context";
import { normalizeAnalyticsFilters, type AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import type {
  AnalyticsDashboard,
  AnalyticsDashboardPageData,
  AnalyticsFilterOptions
} from "@/backend/analytics/contracts/analytics.types";
import type { AnalyticsRepository } from "@/backend/analytics/queries/analytics.repository";

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getDashboard(filters: AnalyticsFilters = {}, context: RequestContext = {}, issueTypeLimit?: number): Promise<any> {
    return await this.repository.getDashboard(normalizeAnalyticsFilters(filters), context, issueTypeLimit);
  }

  async getFilterOptions(filters: AnalyticsFilters = {}, context: RequestContext = {}): Promise<any> {
    return await this.repository.getFilterOptions(normalizeAnalyticsFilters(filters), context);
  }

  async getDashboardPageData(
    filters: AnalyticsFilters = {},
    context: RequestContext = {},
    issueTypeLimit?: number
  ): Promise<any> {
    return await this.repository.getDashboardPageData(normalizeAnalyticsFilters(filters), context, issueTypeLimit);
  }
}
