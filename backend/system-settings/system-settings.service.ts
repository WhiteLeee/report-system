import type {
  AuthSecurityPolicy,
  DeliveryMode,
  HuiYunYingApiSettings,
  SystemSettingsRepository
} from "@/backend/system-settings/system-settings.types";

export class SystemSettingsService {
  constructor(private readonly repository: SystemSettingsRepository) {}

  getHuiYunYingApiSettings(): HuiYunYingApiSettings {
    return this.repository.getHuiYunYingApiSettings();
  }

  saveHuiYunYingApiSettings(settings: HuiYunYingApiSettings): void {
    this.repository.saveHuiYunYingApiSettings({
      uri: settings.uri.trim(),
      route: settings.route.trim(),
      appid: settings.appid.trim(),
      secret: settings.secret.trim(),
      rateLimitCount: Math.max(1, Math.floor(settings.rateLimitCount)),
      rateLimitWindowMs: Math.max(1, Math.floor(settings.rateLimitWindowMs)),
      rectificationCreateRoute: settings.rectificationCreateRoute.trim(),
      rectificationListRoute: settings.rectificationListRoute.trim(),
      rectificationDescriptionMaxLength: Math.max(1, Math.floor(settings.rectificationDescriptionMaxLength)),
      defaultShouldCorrectedDays: Math.max(0, Math.floor(settings.defaultShouldCorrectedDays)),
      rectificationSyncIntervalMs: Math.max(0, Math.floor(settings.rectificationSyncIntervalMs)),
      rectificationSyncRetryCount: Math.max(0, Math.floor(settings.rectificationSyncRetryCount)),
      rectificationSyncTimeoutMs: Math.max(1, Math.floor(settings.rectificationSyncTimeoutMs)),
      rectificationSyncBatchSize: Math.max(1, Math.floor(settings.rectificationSyncBatchSize)),
      analyticsFactRefreshIntervalMs: Math.max(0, Math.floor(settings.analyticsFactRefreshIntervalMs)),
      analyticsSnapshotRefreshIntervalMs: Math.max(0, Math.floor(settings.analyticsSnapshotRefreshIntervalMs))
    });
  }

  getDeliveryMode(): DeliveryMode {
    return this.repository.getDeliveryMode();
  }

  saveDeliveryMode(mode: DeliveryMode): void {
    this.repository.saveDeliveryMode(mode === "customer" ? "customer" : "internal");
  }

  getAuthSecurityPolicy(): AuthSecurityPolicy {
    return this.repository.getAuthSecurityPolicy();
  }

  saveAuthSecurityPolicy(policy: AuthSecurityPolicy): void {
    this.repository.saveAuthSecurityPolicy({
      passwordMinLength: Math.max(8, Math.floor(policy.passwordMinLength)),
      requireUppercase: Boolean(policy.requireUppercase),
      requireLowercase: Boolean(policy.requireLowercase),
      requireNumber: Boolean(policy.requireNumber),
      requireSpecialCharacter: Boolean(policy.requireSpecialCharacter),
      loginMaxFailures: Math.max(1, Math.floor(policy.loginMaxFailures)),
      loginLockDurationMs: Math.max(1000, Math.floor(policy.loginLockDurationMs))
    });
  }
}
