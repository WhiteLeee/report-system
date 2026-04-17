#!/usr/bin/env bash

set -euo pipefail

rs_log() {
  printf '[report-system][%s] %s\n' "${ENV_NAME:-unknown}" "$*"
}

rs_die() {
  printf '[report-system][%s][ERROR] %s\n' "${ENV_NAME:-unknown}" "$*" >&2
  exit 1
}

rs_require_var() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    rs_die "Missing required variable: ${var_name}"
  fi
}

rs_require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || rs_die "Missing command: ${cmd}"
}

rs_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    if [ "${1:-}" = "-u" ]; then
      local target_user="${2:-}"
      shift 2
      [ -n "$target_user" ] || rs_die "rs_sudo -u requires a user"
      [ "$#" -gt 0 ] || rs_die "rs_sudo -u requires a command"

      if command -v runuser >/dev/null 2>&1; then
        runuser -u "$target_user" -- "$@"
      elif command -v sudo >/dev/null 2>&1; then
        sudo -u "$target_user" "$@"
      else
        rs_die "Neither runuser nor sudo is available for user switching"
      fi
    else
      "$@"
    fi
  else
    sudo "$@"
  fi
}

rs_npm() {
  (
    cd "$APP_ROOT"
    if [ "$(id -un)" = "$RUN_USER" ]; then
      PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm "$@"
    else
      rs_sudo -u "$RUN_USER" env PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin npm "$@"
    fi
  )
}

rs_npm_runtime() {
  (
    cd "$APP_ROOT"
    if [ "$(id -un)" = "$RUN_USER" ]; then
      PATH=/opt/homebrew/bin:/usr/local/bin:$PATH \
        REPORT_SYSTEM_TENANT_ID="$TENANT_ID" \
        REPORT_SYSTEM_TENANT_NAME="$TENANT_NAME" \
        REPORT_SYSTEM_BRAND_NAME="$BRAND_NAME" \
        REPORT_SYSTEM_BASE_URL="$BASE_URL" \
        REPORT_SYSTEM_LOGO_URL="${LOGO_URL:-}" \
        REPORT_SYSTEM_PRIMARY_COLOR="${PRIMARY_COLOR:-#8b5a2b}" \
        REPORT_SYSTEM_PRIMARY_COLOR_STRONG="${PRIMARY_COLOR_STRONG:-#6b421d}" \
        REPORT_SYSTEM_DEFAULT_TIMEZONE="${DEFAULT_TIMEZONE:-Asia/Shanghai}" \
        REPORT_SYSTEM_DATA_DIR="$DATA_DIR" \
        REPORT_SYSTEM_DB_PATH="$DB_PATH" \
        REPORT_SYSTEM_TENANT_CONFIG_PATH="$TENANT_CONFIG_PATH" \
        REPORT_SYSTEM_ADMIN_USERNAME="$ADMIN_USERNAME" \
        REPORT_SYSTEM_ADMIN_PASSWORD="${ADMIN_PASSWORD_RUNTIME:-__BOOTSTRAP_ONLY__}" \
        REPORT_SYSTEM_ADMIN_DISPLAY_NAME="$ADMIN_DISPLAY_NAME" \
        REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS="$SUPPORTED_PAYLOAD_VERSIONS" \
        npm "$@"
    else
      rs_sudo -u "$RUN_USER" env \
        PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
        REPORT_SYSTEM_TENANT_ID="$TENANT_ID" \
        REPORT_SYSTEM_TENANT_NAME="$TENANT_NAME" \
        REPORT_SYSTEM_BRAND_NAME="$BRAND_NAME" \
        REPORT_SYSTEM_BASE_URL="$BASE_URL" \
        REPORT_SYSTEM_LOGO_URL="${LOGO_URL:-}" \
        REPORT_SYSTEM_PRIMARY_COLOR="${PRIMARY_COLOR:-#8b5a2b}" \
        REPORT_SYSTEM_PRIMARY_COLOR_STRONG="${PRIMARY_COLOR_STRONG:-#6b421d}" \
        REPORT_SYSTEM_DEFAULT_TIMEZONE="${DEFAULT_TIMEZONE:-Asia/Shanghai}" \
        REPORT_SYSTEM_DATA_DIR="$DATA_DIR" \
        REPORT_SYSTEM_DB_PATH="$DB_PATH" \
        REPORT_SYSTEM_TENANT_CONFIG_PATH="$TENANT_CONFIG_PATH" \
        REPORT_SYSTEM_ADMIN_USERNAME="$ADMIN_USERNAME" \
        REPORT_SYSTEM_ADMIN_PASSWORD="${ADMIN_PASSWORD_RUNTIME:-__BOOTSTRAP_ONLY__}" \
        REPORT_SYSTEM_ADMIN_DISPLAY_NAME="$ADMIN_DISPLAY_NAME" \
        REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS="$SUPPORTED_PAYLOAD_VERSIONS" \
        npm "$@"
    fi
  )
}

rs_check_prereqs() {
  rs_require_var ENV_NAME
  rs_require_var APP_ROOT
  rs_require_var SERVICE_NAME
  rs_require_var ENV_FILE
  rs_require_var DATA_DIR
  rs_require_var DB_PATH
  rs_require_var BACKUP_DIR
  rs_require_var BASE_URL
  rs_require_var TENANT_ID
  rs_require_var TENANT_NAME
  rs_require_var BRAND_NAME
  rs_require_var TENANT_CONFIG_PATH
  rs_require_var APP_PORT
  rs_require_var ADMIN_USERNAME
  rs_require_var ADMIN_DISPLAY_NAME
  rs_require_var SUPPORTED_PAYLOAD_VERSIONS
  rs_require_var RUN_USER
  rs_require_var RUN_GROUP

  rs_require_cmd node
  rs_require_cmd npm
  rs_require_cmd sqlite3
  rs_require_cmd curl

  [ -f "$APP_ROOT/package.json" ] || rs_die "package.json not found under APP_ROOT=${APP_ROOT}"

  rs_sudo mkdir -p "$DATA_DIR" "$BACKUP_DIR" "$(dirname "$ENV_FILE")" "$(dirname "$TENANT_CONFIG_PATH")"

  if ! id -u "$RUN_USER" >/dev/null 2>&1; then
    rs_die "System user not found: ${RUN_USER}"
  fi

  rs_sudo chown -R "$RUN_USER:$RUN_GROUP" "$DATA_DIR" "$BACKUP_DIR"
}

rs_backup_db() {
  rs_check_prereqs
  if [ ! -f "$DB_PATH" ]; then
    rs_log "Database file not found, skip backup: ${DB_PATH}"
    return 0
  fi

  local ts backup_file
  ts="$(date '+%Y%m%d-%H%M%S')"
  backup_file="${BACKUP_DIR}/${ENV_NAME}-${ts}.sqlite3"

  rs_log "Backing up database to ${backup_file}"
  rs_sudo sqlite3 "$DB_PATH" ".backup '${backup_file}'"
  rs_sudo chown "$RUN_USER:$RUN_GROUP" "$backup_file"
  rs_sudo chmod 640 "$backup_file"

  local retention_days
  retention_days="${BACKUP_RETENTION_DAYS:-14}"
  rs_sudo find "$BACKUP_DIR" -type f -name "${ENV_NAME}-*.sqlite3" -mtime +"$retention_days" -delete
}

rs_service_action() {
  local action="$1"
  rs_sudo systemctl "$action" "$SERVICE_NAME"
}

rs_healthcheck() {
  rs_require_var BASE_URL
  rs_require_var APP_PORT
  rs_require_cmd curl
  local timeout_sec url
  timeout_sec="${HEALTHCHECK_TIMEOUT_SEC:-10}"
  url="${HEALTHCHECK_URL:-http://127.0.0.1:${APP_PORT}/login}"

  rs_log "Healthcheck: ${url}"
  curl --fail --silent --show-error --location --max-time "$timeout_sec" "$url" >/dev/null
}

rs_first_init() {
  rs_check_prereqs

  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    rs_die "ADMIN_PASSWORD is required for first initialization."
  fi

  rs_log "Installing dependencies"
  rs_npm ci

  rs_log "Building application"
  rs_npm run build

  local tmp_dir tmp_env_file tmp_config_file runtime_placeholder
  tmp_dir="${APP_ROOT}/.deploy-tmp/${ENV_NAME}"
  tmp_env_file="${tmp_dir}/runtime.env"
  tmp_config_file="${tmp_dir}/tenant.json"
  runtime_placeholder="bootstrap-disabled-${ENV_NAME}-$(date '+%Y%m%d%H%M%S')"

  mkdir -p "$tmp_dir"

  rs_log "Initializing tenant config + env + database"
  rs_npm run tenant:init -- \
    --tenant-id "$TENANT_ID" \
    --tenant-name "$TENANT_NAME" \
    --brand-name "$BRAND_NAME" \
    --base-url "$BASE_URL" \
    --logo-url "${LOGO_URL:-}" \
    --primary-color "${PRIMARY_COLOR:-#8b5a2b}" \
    --primary-color-strong "${PRIMARY_COLOR_STRONG:-#6b421d}" \
    --default-timezone "${DEFAULT_TIMEZONE:-Asia/Shanghai}" \
    --data-dir "$DATA_DIR" \
    --db-path "$DB_PATH" \
    --env-path "$tmp_env_file" \
    --config-path "$tmp_config_file" \
    --admin-username "$ADMIN_USERNAME" \
    --admin-password "$ADMIN_PASSWORD" \
    --admin-display-name "$ADMIN_DISPLAY_NAME" \
    --supported-payload-versions "$SUPPORTED_PAYLOAD_VERSIONS" \
    --force

  rs_log "Sanitizing bootstrap secrets before writing runtime files"
  sed -i.bak "s#^REPORT_SYSTEM_TENANT_CONFIG_PATH=.*#REPORT_SYSTEM_TENANT_CONFIG_PATH=${TENANT_CONFIG_PATH}#" "$tmp_env_file"
  rm -f "${tmp_env_file}.bak"
  sed -i.bak '/^REPORT_SYSTEM_ADMIN_PASSWORD=/d' "$tmp_env_file"
  rm -f "${tmp_env_file}.bak"
  printf 'REPORT_SYSTEM_ADMIN_PASSWORD=%s\n' "$runtime_placeholder" >>"$tmp_env_file"

  node -e "
    const fs = require('node:fs');
    const p = process.argv[1];
    const placeholder = process.argv[2];
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    json.adminPassword = placeholder;
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  " "$tmp_config_file" "$runtime_placeholder"

  rs_log "Installing runtime env + tenant config"
  rs_sudo install -m 640 -o root -g "$RUN_GROUP" "$tmp_env_file" "$ENV_FILE"
  rs_sudo install -m 640 -o "$RUN_USER" -g "$RUN_GROUP" "$tmp_config_file" "$TENANT_CONFIG_PATH"
  rs_sudo rm -rf "$tmp_dir"

  if rs_sudo systemctl list-unit-files | grep -q "^${SERVICE_NAME}"; then
    rs_log "Restarting service ${SERVICE_NAME}"
    rs_service_action restart
    rs_healthcheck
  else
    rs_log "Service ${SERVICE_NAME} is not installed. Run install-systemd.sh first."
  fi
}

rs_deploy() {
  rs_check_prereqs
  rs_backup_db

  rs_log "Installing dependencies"
  rs_npm ci

  rs_log "Building application"
  rs_npm run build

  rs_log "Running migrations"
  rs_npm_runtime run db:migrate

  rs_log "Restarting service"
  rs_service_action restart

  rs_healthcheck
  rs_log "Deploy completed"
}

rs_restore_db() {
  rs_check_prereqs
  local from_file="$1"
  [ -f "$from_file" ] || rs_die "Backup file does not exist: ${from_file}"

  rs_log "Creating safety backup before restore"
  rs_backup_db

  rs_log "Stopping service ${SERVICE_NAME}"
  rs_service_action stop

  rs_log "Restoring database from ${from_file}"
  rs_sudo install -m 640 -o "$RUN_USER" -g "$RUN_GROUP" "$from_file" "$DB_PATH"

  rs_log "Starting service ${SERVICE_NAME}"
  rs_service_action start
  rs_healthcheck
}

rs_install_systemd() {
  rs_check_prereqs
  local unit_path tmp_unit
  unit_path="/etc/systemd/system/${SERVICE_NAME}.service"
  tmp_unit="$(mktemp)"

  cat >"$tmp_unit" <<EOF
[Unit]
Description=Report System (${ENV_NAME})
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_ROOT}
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
ExecStart=/usr/bin/env npm run start
Restart=always
RestartSec=5
User=${RUN_USER}
Group=${RUN_GROUP}

[Install]
WantedBy=multi-user.target
EOF

  rs_sudo install -m 644 "$tmp_unit" "$unit_path"
  rm -f "$tmp_unit"

  rs_sudo systemctl daemon-reload
  rs_sudo systemctl enable "$SERVICE_NAME"
  rs_log "Installed systemd unit: ${unit_path}"
}
