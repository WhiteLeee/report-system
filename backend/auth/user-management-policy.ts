import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { DeliveryMode } from "@/backend/system-settings/system-settings.types";
import type { SessionUser, UserAccount } from "@/backend/auth/auth.types";

const systemSettingsService = createSystemSettingsService();

export async function getCurrentDeliveryMode(): Promise<any> {
  return await systemSettingsService.getDeliveryMode();
}

function isAdminActor(actor: SessionUser | null | undefined): any {
  return Boolean(actor?.roles.includes("admin"));
}

function isReservedAdminUsername(username: string): any {
  return username === getReportSystemConfig().adminUsername;
}

export function isProtectedPlatformUser(
  username: string,
  deliveryMode: DeliveryMode,
  actor?: SessionUser | null
): any {
  if (!isReservedAdminUsername(username)) {
    return false;
  }
  if (deliveryMode === "customer") {
    return true;
  }
  return !isAdminActor(actor);
}

export function filterVisibleUsers(
  users: UserAccount[],
  deliveryMode: DeliveryMode,
  actor?: SessionUser | null
): any {
  if (deliveryMode !== "customer" && isAdminActor(actor)) {
    return users;
  }
  return users.filter((user) => !isProtectedPlatformUser(user.username, deliveryMode, actor));
}

export function assertTargetUserManageable(
  user: UserAccount | null | undefined,
  deliveryMode: DeliveryMode,
  actor?: SessionUser | null
): any {
  if (!user) {
    throw new Error("User not found.");
  }
  if (isProtectedPlatformUser(user.username, deliveryMode, actor)) {
    throw new Error("Target user is protected.");
  }
  return user;
}
