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

export function readMetadataRecord(metadata: JsonValue, key: string): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const value = metadata[key as keyof typeof metadata];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function readMetadataBoolean(metadata: JsonValue, key: string): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return metadata[key as keyof typeof metadata] === true;
}

function readRecordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readRecordBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

function normalizeIssueImageUrls(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((url) => url && url !== "about:blank")));
}

export type ReportImageMode = "evidence" | "original";

export type ResolvedReportImageState = {
  mode: ReportImageMode;
  url: string;
  evidenceUrl: string;
  originalUrl: string;
  displayUrl: string;
  isFallback: boolean;
  fallbackReason: "none" | "missing_evidence" | "load_failed" | "original_mode" | "unavailable";
  unstable: boolean;
  unstableReason: string;
  evidenceSource: string;
};

export function readInspectionEvidenceUrl(inspection: ReportInspection | null | undefined): string {
  return readMetadataString(inspection?.metadata ?? null, "evidence_image_url");
}

export function readInspectionOriginalImageUrl(inspection: ReportInspection | null | undefined): string {
  return readMetadataString(inspection?.metadata ?? null, "original_image_url");
}

export function readInspectionDisplayImageUrl(inspection: ReportInspection | null | undefined): string {
  return readMetadataString(inspection?.metadata ?? null, "display_image_url") || readMetadataString(inspection?.metadata ?? null, "display_url");
}

export function readInspectionEvidenceSource(inspection: ReportInspection | null | undefined): string {
  return readMetadataString(inspection?.metadata ?? null, "evidence_image_source");
}

export function readInspectionProviderMeta(inspection: ReportInspection | null | undefined): Record<string, unknown> {
  return readMetadataRecord(inspection?.metadata ?? null, "provider_meta");
}

export function readIssueExtraJson(issue: ReportIssue | null | undefined): Record<string, unknown> {
  return readMetadataRecord(issue?.metadata ?? null, "extra_json");
}

export function readIssueEvidenceUrl(issue: ReportIssue | null | undefined): string {
  return readMetadataString(issue?.metadata ?? null, "evidence_image_url") ||
    readMetadataString(issue?.metadata ?? null, "linked_inspection_evidence_image_url");
}

export function readIssueRectificationImageUrls(
  issue: ReportIssue | null | undefined,
  options?: { failedInspectionId?: string }
): string[] {
  const failedInspectionId = String(options?.failedInspectionId || "").trim();
  const useOriginalFallback = Boolean(
    failedInspectionId &&
      (
        readMetadataString(issue?.metadata ?? null, "inspection_id") === failedInspectionId ||
        readMetadataString(issue?.metadata ?? null, "linked_inspection_id") === failedInspectionId
      )
  );
  const originalUrls = normalizeIssueImageUrls([
    readMetadataString(issue?.metadata ?? null, "original_image_url"),
    issue?.image_url || "",
    readMetadataString(issue?.metadata ?? null, "display_image_url")
  ]);
  if (useOriginalFallback) {
    return originalUrls.slice(0, 1);
  }
  const evidenceUrls = normalizeIssueImageUrls([
    readMetadataString(issue?.metadata ?? null, "evidence_image_url"),
    readMetadataString(issue?.metadata ?? null, "linked_inspection_evidence_image_url")
  ]);
  return evidenceUrls.length > 0 ? evidenceUrls : originalUrls.slice(0, 1);
}

export function readIssueOriginalImageUrl(issue: ReportIssue | null | undefined): string {
  return readMetadataString(issue?.metadata ?? null, "original_image_url");
}

export function readIssueEvidenceSource(issue: ReportIssue | null | undefined): string {
  return readMetadataString(issue?.metadata ?? null, "evidence_image_source");
}

export function readIssueUnstableEvidence(issue: ReportIssue | null | undefined): boolean {
  const extraJson = readIssueExtraJson(issue);
  return readRecordBoolean(extraJson, "unstable_evidence") || readMetadataBoolean(issue?.metadata ?? null, "unstable_evidence");
}

export function readIssueUnstableEvidenceReason(issue: ReportIssue | null | undefined): string {
  const extraJson = readIssueExtraJson(issue);
  return readRecordString(extraJson, "evidence_asset_override_reason");
}

export function readInspectionUnstableEvidence(inspection: ReportInspection | null | undefined): boolean {
  const providerMeta = readInspectionProviderMeta(inspection);
  return readRecordBoolean(providerMeta, "unstable_evidence");
}

export function readInspectionUnstableEvidenceReason(inspection: ReportInspection | null | undefined): string {
  const providerMeta = readInspectionProviderMeta(inspection);
  return readRecordString(providerMeta, "evidence_asset_override_reason");
}

export function resolveResultImageState(input: {
  selectedResult: ReportResult;
  activeInspection?: ReportInspection | null;
  activeIssue?: ReportIssue | null;
  mode?: ReportImageMode;
  loadFailed?: boolean;
}): ResolvedReportImageState {
  const resultDisplayUrl = readMetadataString(input.selectedResult.metadata, "display_url") || input.selectedResult.url;
  const resultOriginalUrl =
    readMetadataString(input.selectedResult.metadata, "capture_url") ||
    readMetadataString(input.selectedResult.metadata, "preview_url") ||
    resultDisplayUrl;
  const issueEvidenceUrl = input.activeIssue ? readIssueEvidenceUrl(input.activeIssue) : "";
  const issueOriginalUrl = input.activeIssue ? readIssueOriginalImageUrl(input.activeIssue) : "";
  const inspectionEvidenceUrl = readInspectionEvidenceUrl(input.activeInspection);
  const inspectionOriginalUrl = readInspectionOriginalImageUrl(input.activeInspection);
  const inspectionDisplayUrl = readInspectionDisplayImageUrl(input.activeInspection);
  const evidenceUrl = issueEvidenceUrl || inspectionEvidenceUrl;
  const originalUrl = issueOriginalUrl || inspectionOriginalUrl || resultOriginalUrl;
  const displayUrl = evidenceUrl || inspectionDisplayUrl || originalUrl || resultDisplayUrl;
  const mode = input.mode === "original" ? "original" : "evidence";
  const unstable =
    readIssueUnstableEvidence(input.activeIssue) || readInspectionUnstableEvidence(input.activeInspection);
  const unstableReason =
    readIssueUnstableEvidenceReason(input.activeIssue) || readInspectionUnstableEvidenceReason(input.activeInspection);
  const evidenceSource =
    readIssueEvidenceSource(input.activeIssue) || readInspectionEvidenceSource(input.activeInspection);

  if (mode === "original") {
    return {
      mode,
      url: originalUrl || displayUrl,
      evidenceUrl,
      originalUrl,
      displayUrl,
      isFallback: true,
      fallbackReason: "original_mode",
      unstable,
      unstableReason,
      evidenceSource
    };
  }

  if (input.loadFailed && originalUrl) {
    return {
      mode,
      url: originalUrl,
      evidenceUrl,
      originalUrl,
      displayUrl,
      isFallback: true,
      fallbackReason: "load_failed",
      unstable,
      unstableReason,
      evidenceSource
    };
  }

  if (!evidenceUrl && originalUrl) {
    return {
      mode,
      url: originalUrl,
      evidenceUrl,
      originalUrl,
      displayUrl,
      isFallback: true,
      fallbackReason: "missing_evidence",
      unstable,
      unstableReason,
      evidenceSource
    };
  }

  if (!displayUrl) {
    return {
      mode,
      url: "",
      evidenceUrl,
      originalUrl,
      displayUrl,
      isFallback: true,
      fallbackReason: "unavailable",
      unstable,
      unstableReason,
      evidenceSource
    };
  }

  return {
    mode,
    url: displayUrl,
    evidenceUrl,
    originalUrl,
    displayUrl,
    isFallback: false,
    fallbackReason: "none",
    unstable,
    unstableReason,
    evidenceSource
  };
}

export function getResolvedImageNotice(imageState: ResolvedReportImageState): string {
  if (imageState.fallbackReason === "load_failed") {
    return "标注图加载失败，当前为原图。";
  }
  if (imageState.fallbackReason === "missing_evidence") {
    return "标注图不可用，当前为原图。";
  }
  if (imageState.fallbackReason === "original_mode") {
    return "当前正在查看原图。";
  }
  if (imageState.fallbackReason === "unavailable") {
    return "图片不可用。";
  }
  return "";
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
