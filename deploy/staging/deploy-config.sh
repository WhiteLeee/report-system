#!/usr/bin/env bash

# Staging deploy configuration
export ENV_NAME="staging"
export APP_ROOT="/srv/report-system"
export SERVICE_NAME="report-system-staging"
export RUN_USER="report"
export RUN_GROUP="report"

export BASE_URL="http://192.169.65.70"
export APP_PORT="3000"
export HEALTHCHECK_URL="http://127.0.0.1:${APP_PORT}/login"
export HEALTHCHECK_TIMEOUT_SEC="10"

export DATA_DIR="/var/lib/report-system/staging"
export DB_PATH="${DATA_DIR}/report-system.sqlite"
export BACKUP_DIR="/var/backups/report-system/staging"
export BACKUP_RETENTION_DAYS="14"

export ENV_FILE="/etc/report-system/report-system-staging.env"
export TENANT_CONFIG_PATH="${APP_ROOT}/config/tenant.staging.json"

export TENANT_ID="staging-tenant"
export TENANT_NAME="Report System Staging"
export BRAND_NAME="Report System"
export LOGO_URL=""
export PRIMARY_COLOR="#0f172a"
export PRIMARY_COLOR_STRONG="#020617"
export DEFAULT_TIMEZONE="Asia/Shanghai"
export SUPPORTED_PAYLOAD_VERSIONS="2"

# Export these three variables before running first-init.sh
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
export ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-系统管理员}"
