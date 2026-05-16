import { PgSystemSettingsRepository } from "@/backend/system-settings/pg-system-settings.repository";
import { SystemSettingsService } from "@/backend/system-settings/system-settings.service";

export function createSystemSettingsService(): any {
  return new SystemSettingsService(new PgSystemSettingsRepository());
}
