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
  analyticsFactRefreshIntervalMs: number;
  analyticsSnapshotRefreshIntervalMs: number;
}

export type DeliveryMode = "internal" | "customer";

export interface AuthSecurityPolicy {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  loginMaxFailures: number;
  loginLockDurationMs: number;
}

export interface SystemSettingsRepository {
  getHuiYunYingApiSettings(): HuiYunYingApiSettings;
  saveHuiYunYingApiSettings(settings: HuiYunYingApiSettings): void;
  getDeliveryMode(): DeliveryMode;
  saveDeliveryMode(mode: DeliveryMode): void;
  getAuthSecurityPolicy(): AuthSecurityPolicy;
  saveAuthSecurityPolicy(policy: AuthSecurityPolicy): void;
}
