import { NextResponse } from "next/server";

function redirectToUsers(request: Request): Response {
  const url = new URL("/admin/users", request.url);
  url.searchParams.set("error", encodeURIComponent("旧版密码重置接口已停用，请刷新页面后通过“编辑用户-保存修改”提交。"));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request): Promise<Response> {
  return redirectToUsers(request);
}

export async function GET(request: Request): Promise<Response> {
  return redirectToUsers(request);
}
