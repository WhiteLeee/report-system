import { redirect } from "next/navigation";

import { getCurrentSessionUser } from "@/backend/auth/session";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
const systemSettingsService = createSystemSettingsService();

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentSessionUser();
  if (currentUser) {
    redirect("/reports");
  }

  const resolvedSearchParams = await searchParams;
  const error = typeof resolvedSearchParams.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : "";
  const nextPath = typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "/reports";
  const securityPolicy = systemSettingsService.getAuthSecurityPolicy();
  const branding = systemSettingsService.getEnterpriseBrandingSettings();

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-10">
        <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
          <section className="hidden lg:flex lg:flex-col lg:justify-center">
            <div className="inline-flex w-fit items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] shadow-sm">
              VISION REPORT SYSTEM
            </div>
            <div className="mt-6 space-y-5">
              {branding.logoUrl ? (
                <img
                  alt={`${branding.enterpriseName || "企业"} Logo`}
                  className="h-10 w-10 rounded-md border border-[var(--line)] bg-[var(--surface)] object-contain p-1"
                  src={branding.logoUrl}
                />
              ) : null}
              <h1 className="text-5xl font-semibold tracking-tight text-balance text-[var(--text)]">
                视频稽核报告系统
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
                进入巡检报告、复核处理与整改单协同工作台。使用系统账号登录后，按权限进入对应租户与业务范围。
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm sm:p-10">
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                  Welcome back
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">登录</h2>
                  <p className="text-sm leading-6 text-[var(--muted)]">输入账号和密码后进入报告工作台。</p>
                </div>
              </div>

              <form action="/api/auth/login" className="mt-8 space-y-5" method="post">
                <input name="next" type="hidden" value={nextPath} />

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-[var(--text)]" htmlFor="username">
                    账号
                  </label>
                  <Input
                    autoComplete="username"
                    id="username"
                    name="username"
                    placeholder="请输入账号"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-[var(--text)]" htmlFor="password">
                    密码
                  </label>
                  <Input
                    autoComplete="current-password"
                    id="password"
                    minLength={securityPolicy.passwordMinLength}
                    name="password"
                    placeholder={`请输入密码（至少 ${securityPolicy.passwordMinLength} 位）`}
                    required
                    type="password"
                  />
                </div>

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    {error}
                  </div>
                ) : null}

                <Button className="w-full" type="submit">
                  登录
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-8 border-t border-[var(--line)] pt-5 text-sm leading-6 text-[var(--muted)]">
                请输入正确的账号和密码。
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
