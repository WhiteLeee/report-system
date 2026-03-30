import { AuthService } from "@/backend/auth/auth.service";
import { SqliteAuthRepository } from "@/backend/auth/sqlite-auth.repository";

export function createAuthService(): AuthService {
  return new AuthService(new SqliteAuthRepository());
}
