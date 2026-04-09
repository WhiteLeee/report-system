import { AuthService } from "@/backend/auth/auth.service";
import { SqliteAuthRepository } from "@/backend/auth/sqlite-auth.repository";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

export function createAuthService(): AuthService {
  return new AuthService(new SqliteAuthRepository(), createSystemSettingsService());
}
