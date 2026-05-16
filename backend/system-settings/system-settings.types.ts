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

export interface EnterpriseBrandingSettings {
  enterpriseName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  primaryColorStrong: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SystemSettingsRepository {
  getHuiYunYingApiSettings(): any;
  saveHuiYunYingApiSettings(settings: HuiYunYingApiSettings): any;
  getDeliveryMode(): any;
  saveDeliveryMode(mode: DeliveryMode): any;
  getAuthSecurityPolicy(): any;
  saveAuthSecurityPolicy(policy: AuthSecurityPolicy): any;
  getEnterpriseBrandingSettings(): any;
  saveEnterpriseBrandingSettings(settings: EnterpriseBrandingSettings): any;
}
