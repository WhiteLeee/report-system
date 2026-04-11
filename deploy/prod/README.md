# Production Deployment Script Set

Target host:
- `http://vision.weipos.com`

## 1) Prepare

1. Upload repository to `/srv/report-system`
2. Ensure Linux user/group `report` exists
3. Ensure commands exist: `node`, `npm`, `sqlite3`, `curl`, `systemctl`
4. Ensure reverse proxy points to `127.0.0.1:3000`

## 2) First-time initialization

```bash
cd /srv/report-system
chmod +x deploy/shared/lib.sh deploy/prod/*.sh
./deploy/prod/check-prereqs.sh
ADMIN_PASSWORD='YourStrongPassword' ./deploy/prod/first-init.sh
```

说明：
- `ADMIN_PASSWORD` 仅用于首次引导创建管理员，不会以明文持久化到运行时配置。

## 3) Install systemd (first time only)

```bash
cd /srv/report-system
./deploy/prod/install-systemd.sh
sudo systemctl start report-system-prod
```

## 4) Daily release

```bash
cd /srv/report-system
./deploy/prod/deploy.sh
```

## 5) Operations

```bash
./deploy/prod/status.sh
./deploy/prod/restart.sh
./deploy/prod/backup-db.sh
./deploy/prod/restore-db.sh /var/backups/report-system/prod/prod-YYYYMMDD-HHMMSS.sqlite3
./deploy/prod/healthcheck.sh
```
