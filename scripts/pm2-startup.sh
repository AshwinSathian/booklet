#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# pm2-startup.sh — Readable PM2 startup watchdog
#
# Run by com.readable.pm2.plist at login. Ensures readable-app and
# readable-mcp are registered and running in PM2. PM2's own autorestart
# handles individual process crashes; this script covers the boot gap.
#
# Independent of the brnr watchdog: does not compete for the same PM2
# slot — just ensures readable processes are present.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NODE_BIN="$HOME/.nvm/versions/node/v20.19.5/bin"
PM2="$NODE_BIN/pm2"
ECOSYSTEM="/Users/ashwinsathian/Documents/Personal/readable/readable/ecosystem.config.js"
POLL_INTERVAL=15
PING_TIMEOUT_SEC=5
LOG_DIR="$HOME/.readable/logs"
mkdir -p "$LOG_DIR"

export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [readable-pm2] $*"; }

ping_pm2() {
  /usr/bin/perl -e "alarm($PING_TIMEOUT_SEC); exec '$PM2', 'ping'" >/dev/null 2>&1
}

# Returns 0 if a process with the given name is online in PM2
process_online() {
  local name="$1"
  "$PM2" jlist 2>/dev/null | python3 -c \
    "import sys,json; procs=json.load(sys.stdin); exit(0 if any(p['name']=='$name' and p.get('pm2_env',{}).get('status')=='online' for p in procs) else 1)" \
    2>/dev/null
}

ensure_readable() {
  if ! ping_pm2; then
    log "PM2 daemon not responding — skipping (brnr watchdog will resurrect it)"
    return
  fi

  local changed=false

  for svc in readable-app readable-mcp; do
    if process_online "$svc"; then
      log "$svc is already online"
    else
      log "$svc is not running — starting from ecosystem.config.js"
      "$PM2" start "$ECOSYSTEM" --only "$svc" 2>/dev/null \
        && log "$svc started" \
        || log "WARN: failed to start $svc — check: pm2 logs $svc"
      changed=true
    fi
  done

  if $changed; then
    "$PM2" save >/dev/null 2>&1 && log "pm2 dump saved" || true
  fi
}

log "Watchdog starting — ecosystem: $ECOSYSTEM"
sleep 5   # brief pause for PM2 daemon (started by brnr watchdog) to settle

# Initial check
ensure_readable

# Keep running: re-check every $POLL_INTERVAL seconds so if a process crashes
# and PM2 fails to autorestart (e.g. max_restarts exceeded), we catch it.
while true; do
  sleep "$POLL_INTERVAL"
  ensure_readable
done
