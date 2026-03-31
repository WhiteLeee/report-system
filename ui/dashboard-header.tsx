import Link from "next/link";

import styles from "./dashboard-header.module.css";

import type { SessionUser } from "@/backend/auth/auth.types";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  currentUser,
  title,
  subtitle
}: {
  currentUser: SessionUser;
  title: string;
  subtitle: string;
}) {
  const isAdmin = currentUser.roles.includes("admin");

  return (
    <header className={styles.appHeader}>
      <div className={styles.appBrand}>
        <p className="eyebrow">Report Workspace</p>
        <h1 className={styles.appTitle}>{title}</h1>
        <p className={styles.appSubtitle}>{subtitle}</p>
      </div>
      <div className={styles.appHeaderSide}>
        <div className={styles.userSummary}>
          <strong>{currentUser.displayName}</strong>
        </div>
        <nav className={styles.appNav}>
          <Link href="/reports">报告列表</Link>
          <Link href="/rectifications">整改单</Link>
          <Link href="/master-data">门店主数据</Link>
          {isAdmin ? <Link href="/admin/users">用户管理</Link> : null}
          {isAdmin ? <Link href="/admin/settings">系统设置</Link> : null}
        </nav>
        <form action="/api/auth/logout" className={styles.logoutForm} method="post">
          <Button className={styles.logoutButton} type="submit" variant="secondary" size="sm">
            退出登录
          </Button>
        </form>
      </div>
    </header>
  );
}
