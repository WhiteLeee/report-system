import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { SESSION_COOKIE_NAME } from "@/backend/auth/session";

const authService = createAuthService();

export async function POST(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie") || "";
  const target = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (target) {
    authService.logout(decodeURIComponent(target.slice(`${SESSION_COOKIE_NAME}=`.length)));
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0)
  });
  return response;
}
