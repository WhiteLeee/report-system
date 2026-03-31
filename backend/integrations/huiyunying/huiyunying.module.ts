import { HuiYunYingAuthService } from "@/backend/integrations/huiyunying/huiyunying-auth.service";
import { HuiYunYingClient } from "@/backend/integrations/huiyunying/huiyunying-client";
import { resolveHuiYunYingSettings } from "@/backend/integrations/huiyunying/huiyunying-rectification.mapper";
import { HuiYunYingRectificationService } from "@/backend/integrations/huiyunying/huiyunying-rectification.service";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

export function createHuiYunYingRectificationService(): HuiYunYingRectificationService {
  const settings = createSystemSettingsService().getHuiYunYingApiSettings();
  const resolvedSettings = resolveHuiYunYingSettings(settings);
  const authService = new HuiYunYingAuthService(resolvedSettings);
  return new HuiYunYingRectificationService(new HuiYunYingClient(resolvedSettings, authService));
}
