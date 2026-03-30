import { redirect } from "next/navigation";

import styles from "./login-page.module.css";

import { getCurrentSessionUser } from "@/backend/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

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
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : "";
  const nextPath = typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "/reports";

  return (
    <main className={styles.authShell}>
      <div className={styles.authFrame}>
       

        <Card className={styles.authCard}>
          <CardHeader className={styles.authCardHeader}>
            <CardTitle className={styles.cardTitle}>报告系统</CardTitle>
            <CardDescription className={styles.cardDescription}>
              输入账号和密码后进入报告工作台。
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.authCardBody}>
        <form action="/api/auth/login" className={styles.authForm} method="post">
          <input name="next" type="hidden" value={nextPath} />
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="username">账号</label>
            <Input autoComplete="username" className={styles.formControl} id="username" name="username" placeholder="请输入账号" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="password">密码</label>
            <Input autoComplete="current-password" className={styles.formControl} id="password" name="password" placeholder="请输入密码" required type="password" />
          </div>
          {error ? <p className={styles.formError}>{decodeURIComponent(error)}</p> : null}
          <Button className={styles.authSubmit} type="submit">
            登录
          </Button>
        </form>
        <p className={styles.authHint}>请输入正确的账号和密码。</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
