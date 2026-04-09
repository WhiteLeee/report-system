import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { SESSION_COOKIE_NAME } from "@/backend/auth/session";

const authService = createAuthService();

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData().catch(() => new FormData());
  const username = readString(formData, "username");
  const password = readString(formData, "password");
  const nextPath = readString(formData, "next") || "/reports";

  const result = authService.authenticate(username, password);
  if (!result.ok) {
    const loginUrl = new URL("/login", request.url);
    if (result.reason === "locked") {
      const lockText = result.lockedUntil ? result.lockedUntil.replace("T", " ").slice(0, 16) : "";
      loginUrl.searchParams.set(
        "error",
        encodeURIComponent(lockText ? `账号已锁定，请在 ${lockText} 后重试` : "账号已锁定，请稍后重试")
      );
    } else {
      loginUrl.searchParams.set("error", encodeURIComponent("账号或密码错误"));
    }
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(nextPath.startsWith("/") ? nextPath : "/reports", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(result.expiresAt)
  });
  return response;
}
