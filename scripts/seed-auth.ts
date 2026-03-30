import { createAuthService } from "@/backend/auth/auth.module";
import { getReportSystemConfig } from "@/backend/config/report-system-config";

const authService = createAuthService();
const config = getReportSystemConfig();

authService.ensureBootstrap();

console.log("Auth bootstrap completed.");
console.log(`admin-username: ${config.adminUsername}`);
