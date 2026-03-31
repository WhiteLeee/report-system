import { SqliteSystemSettingsRepository } from "@/backend/system-settings/sqlite-system-settings.repository";
import { SystemSettingsService } from "@/backend/system-settings/system-settings.service";

export function createSystemSettingsService(): SystemSettingsService {
  return new SystemSettingsService(new SqliteSystemSettingsRepository());
}
