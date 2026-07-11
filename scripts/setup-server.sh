#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-server.sh
#
# Full idempotent setup for self-hosting Readable on macOS (Apple Silicon or
# Intel) with Cloudflare Tunnel for domain handling.
#
# Run from the repo root on a fresh machine after cloning:
#   bash scripts/setup-server.sh
#
# Idempotent: every step checks current state before acting. Safe to re-run.
#
# What it sets up:
#   • MongoDB Community (Homebrew) — started as a LaunchAgent
#   • Node.js via nvm (or uses existing ≥18 Node)
#   • PM2 process manager — readable-app (:3100) + readable-mcp (:8788)
#   • PM2 LaunchAgent for auto-start on login
#   • Cloudflare Tunnel (cloudflared via Homebrew)
#   • Per-project cloudflared config (not the default config.yml)
#   • User-level LaunchAgent for the Readable tunnel (no sudo required)
#   • DNS CNAME records pointing to the tunnel (uses UUID, not name)
#   • Removes the broken system-level cloudflared daemon if present
#
# Known pitfalls handled automatically:
#   • Port 3000 may be taken — Readable uses 3100 to avoid conflicts
#   • Port collision detection for 3100 and 8788
#   • nc -z on macOS writes to stdout — redirected to /dev/null
#   • cloudflared tunnel route dns by NAME can resolve to wrong tunnel;
#     this script always uses the tunnel UUID
#   • sudo cloudflared service install creates a root-level daemon with no
#     config path — useless and confusing; this script bypasses it entirely
#   • PM2 startup output must be copy-pasted; this script runs it and
#     auto-executes the generated command when safe to do so
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()      { printf "${GREEN}[ ok ]${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
skip()    { printf "${YELLOW}[skip]${RESET}  %s\n" "$*"; }
die()     { printf "\n${RED}[FATAL]${RESET} %s\n\n" "$*" >&2; exit 1; }
section() { printf "\n${BOLD}━━━━  %s  ━━━━${RESET}\n" "$*"; }
prompt()  { printf "${BOLD}%s${RESET} " "$*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_HOME="$HOME"
USERNAME="$(whoami)"

# ── Configurable ports ────────────────────────────────────────────────────────
# Port 3000 is intentionally avoided — other projects (e.g. brnr-api) commonly
# use it. Change these only if 3100/8788 are also taken on your system.
APP_PORT=3100
MCP_PORT=8788

# ── Cloudflare / tunnel IDs ───────────────────────────────────────────────────
# These are filled in when the tunnel exists. The script will detect them.
TUNNEL_NAME="readable-selfhost"
CF_CREDENTIALS_DIR="$USER_HOME/.cloudflared"
CF_CONFIG_FILE="$CF_CREDENTIALS_DIR/readable-config.yml"
CF_LAUNCHAGENT="$USER_HOME/Library/LaunchAgents/com.readable.cloudflared.plist"
CF_LOG_DIR="$USER_HOME/.readable/logs"

# Domains
APP_HOSTNAME="readable.ashwinsathian.com"
API_HOSTNAME="readable-api.ashwinsathian.com"
MCP_HOSTNAME="readable-mcp.ashwinsathian.com"

# ─────────────────────────────────────────────────────────────────────────────
section "Pre-flight checks"
# ─────────────────────────────────────────────────────────────────────────────

[[ "$(uname)" == "Darwin" ]] || die "This script is macOS-only."
ok "macOS detected: $(sw_vers -productVersion)"

cd "$REPO_ROOT" || die "Could not cd to repo root: $REPO_ROOT"
[[ -f "package.json" ]] || die "Run this script from the Readable repo root."
ok "Repo root: $REPO_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
section "Homebrew"
# ─────────────────────────────────────────────────────────────────────────────

if ! command -v brew &>/dev/null; then
  info "Homebrew not found — installing…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  ok "Homebrew $(brew --version | head -1)"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Node.js"
# ─────────────────────────────────────────────────────────────────────────────

if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 18 ]]; then
    ok "Node.js v$NODE_VER"
  else
    die "Node.js v$NODE_VER is too old. Need ≥18. Install via nvm: https://github.com/nvm-sh/nvm"
  fi
else
  die "Node.js not found. Install via nvm or brew install node@20"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "MongoDB Community"
# ─────────────────────────────────────────────────────────────────────────────

if ! brew list mongodb-community &>/dev/null 2>&1; then
  info "Installing MongoDB Community…"
  brew tap mongodb/brew
  brew install mongodb-community
else
  ok "MongoDB Community already installed: $(mongod --version 2>/dev/null | head -1)"
fi

if ! brew services list | grep -q "mongodb-community.*started"; then
  info "Starting MongoDB…"
  brew services start mongodb-community
  sleep 3
fi

nc -z 127.0.0.1 27017 1>/dev/null 2>/dev/null \
  && ok "MongoDB running on :27017" \
  || die "MongoDB didn't start. Check: brew services list | grep mongodb"

# ─────────────────────────────────────────────────────────────────────────────
section "MongoDB indexes"
# ─────────────────────────────────────────────────────────────────────────────

MONGO_URI_LOCAL="mongodb://127.0.0.1:27017/readable?directConnection=true"
EXISTING_INDEXES=$(mongosh "$MONGO_URI_LOCAL" --quiet --eval \
  "db.pages.getIndexes().length" 2>/dev/null || echo "0")

if [[ "$EXISTING_INDEXES" -gt 1 ]]; then
  skip "Indexes already set up ($EXISTING_INDEXES on pages)"
else
  info "Running setup-mongodb.mjs…"
  MONGODB_URI="$MONGO_URI_LOCAL" node "$REPO_ROOT/scripts/setup-mongodb.mjs" \
    && ok "Indexes created" \
    || warn "setup-mongodb.mjs returned non-zero — verify indexes manually"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Environment file"
# ─────────────────────────────────────────────────────────────────────────────

ENV_FILE="$REPO_ROOT/.env.production.local"

if [[ -f "$ENV_FILE" ]]; then
  ok ".env.production.local exists"
  # Verify required keys are set (non-empty, non-placeholder)
  MISSING=()
  for key in MONGODB_URI NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY INVITE_JWT_SECRET; do
    val=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
    if [[ -z "$val" || "$val" == *"REPLACE_ME"* ]]; then
      MISSING+=("$key")
    fi
  done
  if [[ ${#MISSING[@]} -gt 0 ]]; then
    die "Required keys missing or placeholder in .env.production.local:\n  ${MISSING[*]}\nFill them in before continuing."
  fi
  ok "All required env vars are set"
else
  warn ".env.production.local not found."
  info "Creating from template…"
  cp "$REPO_ROOT/.env.production.local.example" "$ENV_FILE"
  printf "\n"
  printf "  Edit %s and fill in:\n" "$ENV_FILE"
  printf "    • CLERK_SECRET_KEY  (from Clerk dashboard)\n"
  printf "    • INVITE_JWT_SECRET (dedicated random secret, e.g. via: openssl rand -base64 32)\n"
  printf "    • MONGODB_URI       (use: mongodb://127.0.0.1:27017/readable?directConnection=true)\n"
  printf "    • Any other keys marked REPLACE_ME\n\n"
  die "Fill in .env.production.local then re-run this script."
fi

# ─────────────────────────────────────────────────────────────────────────────
section "npm dependencies"
# ─────────────────────────────────────────────────────────────────────────────

info "Installing root dependencies…"
npm ci --prefer-offline 2>&1 | tail -3

info "Installing mcp-server dependencies…"
npm ci --prefix mcp-server --prefer-offline 2>&1 | tail -3

ok "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────────
section "Next.js production build"
# ─────────────────────────────────────────────────────────────────────────────

if [[ -d "$REPO_ROOT/.next" && -f "$REPO_ROOT/.next/BUILD_ID" ]]; then
  skip "Existing build found (.next/BUILD_ID exists). Skipping build."
  info "To force a rebuild: rm -rf .next && bash scripts/setup-server.sh"
else
  info "Building Next.js (production)…"
  NODE_ENV=production npm run build
  ok "Build complete"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Port availability"
# ─────────────────────────────────────────────────────────────────────────────

check_port() {
  local port="$1"; local name="$2"
  if nc -z 127.0.0.1 "$port" 1>/dev/null 2>/dev/null; then
    # Port taken — show what's using it
    local owner
    owner=$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR==2{print $1,"(PID",$2")"}')
    # If it's our own PM2 process, that's fine
    if pm2 jlist 2>/dev/null | grep -q "\"$name\""; then
      ok "Port $port in use by $name (already running in PM2)"
    else
      die "Port $port is in use by: $owner\nChange APP_PORT/MCP_PORT at the top of this script and re-run."
    fi
  else
    ok "Port $port is free"
  fi
}

check_port "$APP_PORT" "readable-app"
check_port "$MCP_PORT" "readable-mcp"

# ─────────────────────────────────────────────────────────────────────────────
section "PM2"
# ─────────────────────────────────────────────────────────────────────────────

if ! command -v pm2 &>/dev/null; then
  info "Installing PM2 globally…"
  npm install -g pm2
fi
ok "PM2 $(pm2 --version 2>/dev/null)"

# Start or reload processes from ecosystem config
if pm2 jlist 2>/dev/null | grep -q '"readable-app"'; then
  info "readable-app already in PM2 — reloading with latest config…"
  pm2 reload ecosystem.config.js --update-env 2>&1 | tail -3
else
  info "Starting processes from ecosystem.config.js…"
  pm2 start ecosystem.config.js 2>&1 | tail -5
fi

sleep 4   # let processes settle

# Verify both are online
APP_STATUS=$(pm2 jlist 2>/dev/null | python3 -c \
  "import sys,json; p=[x for x in json.load(sys.stdin) if x['name']=='readable-app']; \
   print(p[0]['pm2_env']['status'] if p else 'missing')")
MCP_STATUS=$(pm2 jlist 2>/dev/null | python3 -c \
  "import sys,json; p=[x for x in json.load(sys.stdin) if x['name']=='readable-mcp']; \
   print(p[0]['pm2_env']['status'] if p else 'missing')")

[[ "$APP_STATUS" == "online" ]] && ok "readable-app is online" \
  || die "readable-app failed to start (status: $APP_STATUS). Check: pm2 logs readable-app"
[[ "$MCP_STATUS" == "online" ]] && ok "readable-mcp is online" \
  || die "readable-mcp failed to start (status: $MCP_STATUS). Check: pm2 logs readable-mcp"

# ─────────────────────────────────────────────────────────────────────────────
section "PM2 startup (LaunchAgent)"
# ─────────────────────────────────────────────────────────────────────────────

# Detect any existing PM2 LaunchAgent (another project may have already done this)
EXISTING_PM2_PLIST=$(ls "$USER_HOME/Library/LaunchAgents/"*pm2*.plist 2>/dev/null | head -1 || true)

if [[ -n "$EXISTING_PM2_PLIST" ]]; then
  skip "PM2 LaunchAgent already installed: $(basename "$EXISTING_PM2_PLIST")"
  info "PM2 will use the existing LaunchAgent to start on login."
else
  info "Generating PM2 startup LaunchAgent…"
  # pm2 startup prints a command we must run; capture and execute it
  STARTUP_CMD=$(pm2 startup launchd -u "$USERNAME" --hp "$USER_HOME" 2>&1 \
    | grep "sudo" | head -1)
  if [[ -n "$STARTUP_CMD" ]]; then
    info "Running: $STARTUP_CMD"
    eval "$STARTUP_CMD"
    ok "PM2 LaunchAgent installed"
  else
    warn "Could not parse pm2 startup command. Run manually:"
    warn "  pm2 startup launchd -u $USERNAME --hp $USER_HOME"
    warn "  Then run the 'sudo env PATH=...' command it prints."
  fi
fi

pm2 save
ok "PM2 process list saved"

# ─────────────────────────────────────────────────────────────────────────────
section "cloudflared"
# ─────────────────────────────────────────────────────────────────────────────

if ! command -v cloudflared &>/dev/null; then
  info "Installing cloudflared via Homebrew…"
  brew install cloudflared
fi
ok "cloudflared $(cloudflared --version 2>&1 | head -1)"

# Remove the broken system daemon (created by 'sudo cloudflared service install').
# It has no config path and runs as root, pointing to /var/root/.cloudflared which
# doesn't exist. It does nothing useful and pollutes launchctl.
SYSTEM_PLIST="/Library/LaunchDaemons/com.cloudflare.cloudflared.plist"
if [[ -f "$SYSTEM_PLIST" ]]; then
  warn "Found broken system-level cloudflared daemon at $SYSTEM_PLIST"
  info "Removing it (this requires sudo)…"
  sudo launchctl unload "$SYSTEM_PLIST" 2>/dev/null || true
  sudo rm -f "$SYSTEM_PLIST"
  ok "Removed broken system daemon"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Cloudflare Tunnel authentication"
# ─────────────────────────────────────────────────────────────────────────────

if [[ -f "$CF_CREDENTIALS_DIR/cert.pem" ]]; then
  ok "Cloudflare credentials present ($CF_CREDENTIALS_DIR/cert.pem)"
else
  warn "Not authenticated with Cloudflare."
  printf "\n  Running: cloudflared tunnel login\n  A browser window will open — authorise for ashwinsathian.com\n\n"
  cloudflared tunnel login
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Cloudflare Tunnel"
# ─────────────────────────────────────────────────────────────────────────────

# Look for an existing 'readable-selfhost' tunnel
TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null \
  | awk -v name="$TUNNEL_NAME" '$2 == name {print $1}' | head -1)

if [[ -n "$TUNNEL_UUID" ]]; then
  ok "Tunnel '$TUNNEL_NAME' exists: $TUNNEL_UUID"
else
  info "Creating tunnel '$TUNNEL_NAME'…"
  cloudflared tunnel create "$TUNNEL_NAME" 2>&1
  TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null \
    | awk -v name="$TUNNEL_NAME" '$2 == name {print $1}' | head -1)
  [[ -n "$TUNNEL_UUID" ]] || die "Tunnel creation failed. Check: cloudflared tunnel list"
  ok "Tunnel created: $TUNNEL_UUID"
fi

CREDENTIALS_FILE="$CF_CREDENTIALS_DIR/${TUNNEL_UUID}.json"
[[ -f "$CREDENTIALS_FILE" ]] \
  || die "Tunnel credentials not found: $CREDENTIALS_FILE\n\nIf migrating to a new machine, copy ~/.cloudflared/*.json from the original machine."

# ─────────────────────────────────────────────────────────────────────────────
section "Tunnel configuration file"
# ─────────────────────────────────────────────────────────────────────────────

if [[ -f "$CF_CONFIG_FILE" ]]; then
  # Verify the config points to the right tunnel UUID
  CONF_UUID=$(grep "^tunnel:" "$CF_CONFIG_FILE" | awk '{print $2}')
  if [[ "$CONF_UUID" == "$TUNNEL_UUID" ]]; then
    skip "readable-config.yml already correct (tunnel: $TUNNEL_UUID)"
  else
    warn "readable-config.yml points to wrong tunnel ($CONF_UUID ≠ $TUNNEL_UUID). Rewriting…"
    REWRITE_CONFIG=true
  fi
else
  REWRITE_CONFIG=true
fi

if [[ "${REWRITE_CONFIG:-false}" == "true" ]]; then
  cat > "$CF_CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_UUID}
credentials-file: ${CF_CREDENTIALS_DIR}/${TUNNEL_UUID}.json

retries: 5
grace-period: 30s

ingress:
  - hostname: ${APP_HOSTNAME}
    service: http://127.0.0.1:${APP_PORT}
    originRequest:
      connectTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 10
      httpHostHeader: ${APP_HOSTNAME}

  # Same app/port as above — dedicated hostname for external API consumers
  # (CLI/GitHub Action/VS Code/MCP). src/middleware.ts restricts this
  # hostname to /api/* only.
  - hostname: ${API_HOSTNAME}
    service: http://127.0.0.1:${APP_PORT}
    originRequest:
      connectTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 10
      httpHostHeader: ${API_HOSTNAME}

  - hostname: ${MCP_HOSTNAME}
    service: http://127.0.0.1:${MCP_PORT}
    originRequest:
      connectTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 10
      httpHostHeader: ${MCP_HOSTNAME}

  - service: http_status:404
EOF
  ok "Written $CF_CONFIG_FILE"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "DNS CNAME records"
# ─────────────────────────────────────────────────────────────────────────────

# Always use UUID (not tunnel name) to avoid cloudflared routing to the wrong tunnel.
setup_dns() {
  local hostname="$1"
  # Check what CNAME currently exists. Cloudflare flattens CNAMEs to A records
  # for proxied records, so we use cloudflared tunnel info to verify.
  info "Configuring DNS for $hostname → $TUNNEL_UUID…"
  cloudflared tunnel route dns -f "$TUNNEL_UUID" "$hostname" 2>&1 \
    | grep -E "INF|ERR|warn" \
    | while IFS= read -r line; do info "  $line"; done
}

setup_dns "$APP_HOSTNAME"
setup_dns "$API_HOSTNAME"
setup_dns "$MCP_HOSTNAME"
ok "DNS routes configured"

# ─────────────────────────────────────────────────────────────────────────────
section "cloudflared LaunchAgent"
# ─────────────────────────────────────────────────────────────────────────────

mkdir -p "$CF_LOG_DIR"

if [[ -f "$CF_LAUNCHAGENT" ]]; then
  # Verify it points to our config (not brnr's or something else)
  PLIST_CONFIG=$(grep -A1 "<string>--config</string>" "$CF_LAUNCHAGENT" 2>/dev/null \
    | grep "string" | sed 's/.*<string>\(.*\)<\/string>/\1/' | head -1)
  if [[ "$PLIST_CONFIG" == "$CF_CONFIG_FILE" ]]; then
    skip "com.readable.cloudflared LaunchAgent already correct"
  else
    warn "LaunchAgent exists but points to wrong config ($PLIST_CONFIG). Rewriting…"
    launchctl unload "$CF_LAUNCHAGENT" 2>/dev/null || true
    REWRITE_PLIST=true
  fi
else
  REWRITE_PLIST=true
fi

if [[ "${REWRITE_PLIST:-false}" == "true" ]]; then
  cat > "$CF_LAUNCHAGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.readable.cloudflared</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/cloudflared</string>
    <string>tunnel</string>
    <string>--config</string>
    <string>${CF_CONFIG_FILE}</string>
    <string>--no-autoupdate</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${CF_LOG_DIR}/cloudflared.out.log</string>
  <key>StandardErrorPath</key>
  <string>${CF_LOG_DIR}/cloudflared.err.log</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
EOF
  ok "Written $CF_LAUNCHAGENT"
fi

# Load / reload the agent
if launchctl list 2>/dev/null | grep -q "com.readable.cloudflared"; then
  info "Reloading com.readable.cloudflared…"
  launchctl unload "$CF_LAUNCHAGENT" 2>/dev/null || true
  sleep 1
fi
launchctl load "$CF_LAUNCHAGENT"
sleep 3

launchctl list 2>/dev/null | grep -q "com.readable.cloudflared" \
  && ok "com.readable.cloudflared loaded and running" \
  || die "LaunchAgent failed to load. Check: tail -50 $CF_LOG_DIR/cloudflared.err.log"

# ─────────────────────────────────────────────────────────────────────────────
section "Readable PM2 watchdog LaunchAgent"
# ─────────────────────────────────────────────────────────────────────────────
# This agent runs the pm2-startup.sh watchdog at login. It is independent of
# the brnr PM2 watchdog — it only ensures readable-app and readable-mcp are
# present in PM2 and starts them from ecosystem.config.js if they're missing.

READABLE_PM2_PLIST="$USER_HOME/Library/LaunchAgents/com.readable.pm2.plist"
READABLE_PM2_LOG_DIR="$USER_HOME/.readable/logs"
# launchd cannot read scripts from ~/Documents (TCC restriction).
# We copy pm2-startup.sh to ~/.readable/ on every setup so launchd can reach it.
READABLE_STARTUP_SRC="$REPO_ROOT/scripts/pm2-startup.sh"
READABLE_STARTUP_SCRIPT="$USER_HOME/.readable/pm2-startup.sh"

mkdir -p "$READABLE_PM2_LOG_DIR"

# Keep the deployed copy in sync with the repo source
cp "$READABLE_STARTUP_SRC" "$READABLE_STARTUP_SCRIPT"
chmod +x "$READABLE_STARTUP_SCRIPT"
# Remove provenance xattr so launchd can execute the file
xattr -d com.apple.provenance "$READABLE_STARTUP_SCRIPT" 2>/dev/null || true
ok "Copied pm2-startup.sh → $READABLE_STARTUP_SCRIPT"

if [[ -f "$READABLE_PM2_PLIST" ]]; then
  PLIST_SCRIPT=$(grep -A1 "<string>bash</string>" "$READABLE_PM2_PLIST" 2>/dev/null \
    | grep "string" | sed 's/.*<string>\(.*\)<\/string>/\1/' | head -1)
  if [[ "$PLIST_SCRIPT" == "$READABLE_STARTUP_SCRIPT" ]]; then
    skip "com.readable.pm2 LaunchAgent already correct"
  else
    warn "LaunchAgent exists but points to wrong script. Rewriting…"
    launchctl unload "$READABLE_PM2_PLIST" 2>/dev/null || true
    REWRITE_PM2_PLIST=true
  fi
else
  REWRITE_PM2_PLIST=true
fi

if [[ "${REWRITE_PM2_PLIST:-false}" == "true" ]]; then
  cat > "$READABLE_PM2_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.readable.pm2</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${READABLE_STARTUP_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>StandardOutPath</key>
  <string>${READABLE_PM2_LOG_DIR}/pm2-startup.out.log</string>
  <key>StandardErrorPath</key>
  <string>${READABLE_PM2_LOG_DIR}/pm2-startup.err.log</string>
</dict>
</plist>
EOF
  ok "Written $READABLE_PM2_PLIST"
fi

if launchctl list 2>/dev/null | grep -q "com.readable.pm2"; then
  info "Reloading com.readable.pm2…"
  launchctl unload "$READABLE_PM2_PLIST" 2>/dev/null || true
  sleep 1
fi
launchctl load "$READABLE_PM2_PLIST"
sleep 2

launchctl list 2>/dev/null | grep -q "com.readable.pm2" \
  && ok "com.readable.pm2 loaded" \
  || warn "com.readable.pm2 failed to load — run: launchctl load $READABLE_PM2_PLIST"

# ─────────────────────────────────────────────────────────────────────────────
section "Tunnel connectivity"
# ─────────────────────────────────────────────────────────────────────────────

info "Waiting up to 15 s for tunnel to connect…"
for i in $(seq 1 15); do
  CONNECTIONS=$(cloudflared tunnel info "$TUNNEL_UUID" 2>/dev/null \
    | grep -c "CONNECTOR ID" || true)
  if [[ "$CONNECTIONS" -gt 0 ]]; then
    ok "Tunnel is live (connector registered)"
    break
  fi
  sleep 1
done
[[ "$CONNECTIONS" -gt 0 ]] \
  || warn "Tunnel not yet connected. Check: tail -30 $CF_LOG_DIR/cloudflared.err.log"

# ─────────────────────────────────────────────────────────────────────────────
section "Health check"
# ─────────────────────────────────────────────────────────────────────────────

info "Running full health check…"
bash "$REPO_ROOT/scripts/health-check.sh" 2>&1 || true

# ─────────────────────────────────────────────────────────────────────────────
section "Manual Cloudflare dashboard steps required"
# ─────────────────────────────────────────────────────────────────────────────

printf "\n${BOLD}Everything on this machine is running. Complete these steps in the CF dashboard:${RESET}\n\n"

printf "  ${CYAN}1. Remove Worker routes${RESET}\n"
printf "     Workers & Pages → 'readable' → Settings → Triggers → Routes\n"
printf "     Delete route: %s/*\n\n" "$APP_HOSTNAME"
printf "     Workers & Pages → 'readable-mcp' → Settings → Triggers → Routes\n"
printf "     Delete route: %s/*\n\n" "$MCP_HOSTNAME"

printf "  ${CYAN}2. Set SSL/TLS mode to Full (not Strict)${RESET}\n"
printf "     SSL/TLS → Overview → Full\n\n"

printf "  ${CYAN}3. Enable Always Online${RESET}\n"
printf "     Speed → Optimization → Always Online → On\n\n"

printf "  ${CYAN}4. Add custom error pages for 521, 522, 524${RESET}\n"
printf "     Custom Pages → upload a branded HTML page for each error code\n\n"

printf "  ${CYAN}5. Add cache rules${RESET}\n"
printf "     Caching → Cache Rules:\n"
printf "     • /_next/static/* → Edge TTL 30d, serve stale on origin error\n"
printf "     • /p/*            → Edge TTL 5m, serve stale up to 1h\n\n"

printf "${GREEN}${BOLD}Setup complete.${RESET}\n\n"
