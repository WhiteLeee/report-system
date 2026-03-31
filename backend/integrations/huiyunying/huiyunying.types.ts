export interface HuiYunYingResolvedSettings {
  baseUri: string;
  signPath: string;
  appid: string;
  secret: string;
  rectificationCreateRoute: string;
  rectificationListRoute: string;
  rateLimitCount: number;
  rateLimitWindowMs: number;
  rectificationDescriptionMaxLength: number;
  defaultShouldCorrectedDays: number;
  rectificationSyncIntervalMs: number;
}

export interface HuiYunYingSignResponse {
  token?: string;
  message?: string;
  error?: string;
  error_msg?: string;
  data?: {
    token?: string;
  };
  [key: string]: unknown;
}

export interface HuiYunYingCreateRectificationInput {
  storeId?: number;
  storeCode?: string;
  description: string;
  shouldCorrected: string;
  imageUrls: string[];
}

export interface HuiYunYingRectificationOrderItem {
  disqualifiedId?: number | string;
  ifCorrected?: string;
  storeId?: string;
  storeCode?: string;
  description?: string;
  createTime?: string;
  shouldCorrected?: string;
  realCorrected?: string;
  realCorrectedTime?: string;
  modifiedTime?: string;
  [key: string]: unknown;
}

export interface HuiYunYingListRectificationInput {
  searchName: string;
  ifCorrected?: string;
  itemSource?: string;
  pageNumber: number;
  pageSize: number;
  creatorCode?: string;
  startDate: string;
  endDate: string;
  organizeCode?: number;
  modifyStartDate: string;
  modifyEndDate: string;
}
