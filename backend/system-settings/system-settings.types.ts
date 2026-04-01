export interface HuiYunYingApiSettings {
  uri: string;
  route: string;
  appid: string;
  secret: string;
  rateLimitCount: number;
  rateLimitWindowMs: number;
  rectificationCreateRoute: string;
  rectificationListRoute: string;
  rectificationDescriptionMaxLength: number;
  defaultShouldCorrectedDays: number;
  rectificationSyncIntervalMs: number;
  rectificationSyncRetryCount: number;
  rectificationSyncTimeoutMs: number;
  rectificationSyncBatchSize: number;
}

export interface SystemSettingsRepository {
  getHuiYunYingApiSettings(): HuiYunYingApiSettings;
  saveHuiYunYingApiSettings(settings: HuiYunYingApiSettings): void;
}
