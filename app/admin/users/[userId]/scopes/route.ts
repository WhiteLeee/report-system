import { NextResponse } from "next/server";
import { buildRequestUrl } from "@/backend/http/request-url";

function redirectToUsers(request: Request): Response {
  const url = buildRequestUrl(request, "/admin/users");
  url.searchParams.set("error", encodeURIComponent("旧版范围授权接口已停用，请刷新页面后通过“编辑用户-保存修改”提交。"));
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request): Promise<Response> {
  return redirectToUsers(request);
}

export async function GET(request: Request): Promise<Response> {
  return redirectToUsers(request);
}
