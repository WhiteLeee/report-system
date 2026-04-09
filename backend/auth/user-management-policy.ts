import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { DeliveryMode } from "@/backend/system-settings/system-settings.types";
import type { SessionUser, UserAccount } from "@/backend/auth/auth.types";

const systemSettingsService = createSystemSettingsService();

export function getCurrentDeliveryMode(): DeliveryMode {
  return systemSettingsService.getDeliveryMode();
}

function isAdminActor(actor: SessionUser | null | undefined): boolean {
  return Boolean(actor?.roles.includes("admin"));
}

function isReservedAdminUsername(username: string): boolean {
  return username === getReportSystemConfig().adminUsername;
}

export function isProtectedPlatformUser(
  username: string,
  deliveryMode = getCurrentDeliveryMode(),
  actor?: SessionUser | null
): boolean {
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
  deliveryMode = getCurrentDeliveryMode(),
  actor?: SessionUser | null
): UserAccount[] {
  if (deliveryMode !== "customer" && isAdminActor(actor)) {
    return users;
  }
  return users.filter((user) => !isProtectedPlatformUser(user.username, deliveryMode, actor));
}

export function assertTargetUserManageable(
  user: UserAccount | null | undefined,
  deliveryMode = getCurrentDeliveryMode(),
  actor?: SessionUser | null
): UserAccount {
  if (!user) {
    throw new Error("User not found.");
  }
  if (isProtectedPlatformUser(user.username, deliveryMode, actor)) {
    throw new Error("Target user is protected.");
  }
  return user;
}
