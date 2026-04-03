export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  enterpriseId?: string;
  organizationId?: string;
  franchiseeName?: string;
  storeId?: string;
  reportType?: string;
  topic?: string;
  planId?: string;
}

function normalizeString(value: string | undefined): string {
  return String(value || "").trim();
}

export function normalizeAnalyticsFilters(filters: AnalyticsFilters = {}): AnalyticsFilters {
  return {
    startDate: normalizeString(filters.startDate),
    endDate: normalizeString(filters.endDate),
    enterpriseId: normalizeString(filters.enterpriseId),
    organizationId: normalizeString(filters.organizationId),
    franchiseeName: normalizeString(filters.franchiseeName),
    storeId: normalizeString(filters.storeId),
    reportType: normalizeString(filters.reportType),
    topic: normalizeString(filters.topic),
    planId: normalizeString(filters.planId)
  };
}
