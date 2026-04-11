# Staging Deployment Script Set

Target host:
- `192.169.65.70`

## 1) Prepare

1. Upload repository to `/srv/report-system`
2. Ensure Linux user/group `report` exists
3. Ensure commands exist: `node`, `npm`, `sqlite3`, `curl`, `systemctl`

## 2) First-time initialization

```bash
cd /srv/report-system
chmod +x deploy/shared/lib.sh deploy/staging/*.sh
./deploy/staging/check-prereqs.sh
ADMIN_PASSWORD='YourStrongPassword' ./deploy/staging/first-init.sh
```

说明：
- `ADMIN_PASSWORD` 仅用于首次引导创建管理员，不会以明文持久化到运行时配置。

## 3) Install systemd (first time only)

```bash
cd /srv/report-system
./deploy/staging/install-systemd.sh
sudo systemctl start report-system-staging
```

## 4) Daily release

```bash
cd /srv/report-system
./deploy/staging/deploy.sh
```

## 5) Operations

```bash
./deploy/staging/status.sh
./deploy/staging/restart.sh
./deploy/staging/backup-db.sh
./deploy/staging/restore-db.sh /var/backups/report-system/staging/staging-YYYYMMDD-HHMMSS.sqlite3
./deploy/staging/healthcheck.sh
```
