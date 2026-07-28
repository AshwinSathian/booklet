#!/usr/bin/env bash
# Full update: pull latest code from remote, then rebuild and restart.
# Use this for manual updates when you want to sync from remote.
# For a redeploy without pulling, run scripts/redeploy.sh directly.
set -euo pipefail

REPO="/Users/ashwinsathian/Documents/Personal/booklet"

cd "$REPO"
echo "[deploy-local] Pulling latest from remote..."
git pull --ff-only

echo "[deploy-local] Handing off to redeploy..."
bash "$REPO/scripts/redeploy.sh"
