import { AuthService } from "@/backend/auth/auth.service";
import { PgAuthRepository } from "@/backend/auth/pg-auth.repository";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

export function createAuthService(): any {
  return new AuthService(new PgAuthRepository(), createSystemSettingsService());
}
