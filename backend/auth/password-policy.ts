import type { AuthSecurityPolicy } from "@/backend/system-settings/system-settings.types";

export function validatePasswordWithPolicy(password: string, policy: AuthSecurityPolicy): string[] {
  const reasons: string[] = [];
  if (password.length < policy.passwordMinLength) {
    reasons.push(`密码长度至少 ${policy.passwordMinLength} 位`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    reasons.push("需要包含大写字母");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    reasons.push("需要包含小写字母");
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    reasons.push("需要包含数字");
  }
  if (policy.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) {
    reasons.push("需要包含特殊字符");
  }
  return reasons;
}

export function assertPasswordWithPolicy(password: string, policy: AuthSecurityPolicy): void {
  const reasons = validatePasswordWithPolicy(password, policy);
  if (reasons.length > 0) {
    throw new Error(`密码不符合安全策略：${reasons.join("，")}`);
  }
}
