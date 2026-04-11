#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/deploy-config.sh"
source "${SCRIPT_DIR}/../shared/lib.sh"

rs_install_systemd

