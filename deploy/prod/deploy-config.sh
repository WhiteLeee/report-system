#!/usr/bin/env bash

# Production deploy configuration
export ENV_NAME="prod"
export APP_ROOT="/srv/report-system"
export SERVICE_NAME="report-system-prod"
export RUN_USER="report"
export RUN_GROUP="report"

export BASE_URL="http://vision.weipos.com"
export APP_PORT="3000"
export HEALTHCHECK_URL="http://127.0.0.1:${APP_PORT}/login"
export HEALTHCHECK_TIMEOUT_SEC="10"

export DATA_DIR="/var/lib/report-system/prod"
export DB_PATH="${DATA_DIR}/report-system.sqlite"
export BACKUP_DIR="/var/backups/report-system/prod"
export BACKUP_RETENTION_DAYS="30"

export ENV_FILE="/etc/report-system/report-system-prod.env"
export TENANT_CONFIG_PATH="${APP_ROOT}/config/tenant.prod.json"

export TENANT_ID="weipos-prod"
export TENANT_NAME="慧运营"
export BRAND_NAME="慧运营巡检报告"
export LOGO_URL=""
export PRIMARY_COLOR="#0f172a"
export PRIMARY_COLOR_STRONG="#020617"
export DEFAULT_TIMEZONE="Asia/Shanghai"
export SUPPORTED_PAYLOAD_VERSIONS="2"

# Export these three variables before running first-init.sh
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
export ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-系统管理员}"
