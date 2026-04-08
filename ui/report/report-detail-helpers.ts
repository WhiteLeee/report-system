import type { JsonValue } from "@/backend/shared/json";
import type { ReportInspection, ReportIssue, ReportResult, ReportStore, ReviewFilterState } from "@/backend/report/report.types";
import type { ReportResultSemanticState } from "@/ui/report/report-result-semantics";

export type DetailFilters = {
  organization: string;
  storeId: string;
  reviewStatus: ReviewFilterState;
  semanticState: ReportResultSemanticState | "";
  page: number;
  pageSize: 30 | 50 | 100 | 200;
};

export const DETAIL_PAGE_SIZE_OPTIONS = [30, 50, 100, 200] as const;

export function readMetadataString(metadata: JsonValue, key: string): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = metadata[key as keyof typeof metadata];
  return typeof value === "string" ? value : "";
}

export function buildScopeStoreIds(stores: ReportStore[], filters: DetailFilters): Set<string> {
  return new Set(
    stores
      .filter((store) => {
        if (filters.organization && store.organization_name !== filters.organization) {
          return false;
        }
        if (filters.storeId && store.store_id !== filters.storeId) {
          return false;
        }
        if (filters.reviewStatus && store.progress_state !== filters.reviewStatus) {
          return false;
        }
        return true;
      })
      .map((store) => store.store_id)
  );
}

export function filterStores(stores: ReportStore[], filters: DetailFilters): ReportStore[] {
  return stores.filter((store) => {
    if (filters.organization && store.organization_name !== filters.organization) {
      return false;
    }
    if (filters.storeId && store.store_id !== filters.storeId) {
      return false;
    }
    if (filters.reviewStatus && store.progress_state !== filters.reviewStatus) {
      return false;
    }
    return true;
  });
}

export function filterImages(images: ReportResult[], scopedStoreIds: Set<string>, filters: DetailFilters): ReportResult[] {
  return images.filter((image) => {
    if (filters.storeId && image.store_id !== filters.storeId) {
      return false;
    }
    if (filters.organization || filters.storeId || filters.reviewStatus) {
      if (image.store_id && scopedStoreIds.size > 0 && !scopedStoreIds.has(image.store_id)) {
        return false;
      }
      if ((filters.organization || filters.storeId) && image.store_id && scopedStoreIds.size === 0) {
        return false;
      }
    }
    if (filters.reviewStatus && filters.reviewStatus !== "in_progress" && image.review_state !== filters.reviewStatus) {
      return false;
    }
    return true;
  });
}

export function filterIssues(issues: ReportIssue[], scopedStoreIds: Set<string>, filters: DetailFilters): ReportIssue[] {
  return issues.filter((issue) => {
    if (filters.storeId && issue.store_id !== filters.storeId) {
      return false;
    }
    if (filters.organization || filters.storeId || filters.reviewStatus) {
      if (issue.store_id && scopedStoreIds.size > 0 && !scopedStoreIds.has(issue.store_id)) {
        return false;
      }
      if ((filters.organization || filters.storeId) && issue.store_id && scopedStoreIds.size === 0) {
        return false;
      }
    }
    if (filters.reviewStatus && filters.reviewStatus !== "in_progress" && issue.review_state !== filters.reviewStatus) {
      return false;
    }
    return true;
  });
}

export function buildSearch(filters: DetailFilters): string {
  const searchParams = new URLSearchParams();
  if (filters.organization) {
    searchParams.set("organization", filters.organization);
  }
  if (filters.storeId) {
    searchParams.set("storeId", filters.storeId);
  }
  if (filters.reviewStatus) {
    searchParams.set("reviewStatus", filters.reviewStatus);
  }
  if (filters.semanticState) {
    searchParams.set("semanticState", filters.semanticState);
  }
  if (filters.page > 1) {
    searchParams.set("page", String(filters.page));
  }
  if (filters.pageSize !== 30) {
    searchParams.set("pageSize", String(filters.pageSize));
  }
  const search = searchParams.toString();
  return search ? `?${search}` : "";
}

export function matchesIssueToImage(issue: ReportIssue, image: ReportResult): boolean {
  if (issue.result_id && issue.result_id === image.id) {
    return true;
  }
  const issueCaptureId = readMetadataString(issue.metadata, "capture_id");
  const imageCaptureId = readMetadataString(image.metadata, "capture_id");
  if (issueCaptureId && imageCaptureId) {
    return issueCaptureId === imageCaptureId;
  }

  return issue.store_id === image.store_id;
}

export function matchesInspectionToImage(inspection: ReportInspection, image: ReportResult): boolean {
  if (inspection.result_id && inspection.result_id === image.id) {
    return true;
  }
  const inspectionCaptureId = readMetadataString(inspection.metadata, "capture_id");
  const imageCaptureId = readMetadataString(image.metadata, "capture_id");
  if (inspectionCaptureId && imageCaptureId) {
    return inspectionCaptureId === imageCaptureId;
  }
  return inspection.store_id === image.store_id;
}
