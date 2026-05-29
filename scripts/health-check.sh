#!/usr/bin/env bash
# Run from anywhere: bash scripts/health-check.sh
# Exits 0 if all checks pass, 1 if any fail.
set -euo pipefail

PASS=0; FAIL=0; WARN=0

_check() {
  local name="$1"; local expect="$2"; shift 2
  local result
  result=$(eval "$*" 2>&1 | head -1 || true)
  if echo "$result" | grep -q "$expect"; then
    printf "  \033[32m✓\033[0m %s\n" "$name"
    ((PASS++)) || true
  else
    printf "  \033[31m✗\033[0m %s  \033[2m(got: %s)\033[0m\n" "$name" "$result"
    ((FAIL++)) || true
  fi
}

_warn() {
  local name="$1"; local expect="$2"; shift 2
  local result
  result=$(eval "$*" 2>&1 | head -1 || true)
  if echo "$result" | grep -q "$expect"; then
    printf "  \033[32m✓\033[0m %s\n" "$name"
    ((PASS++)) || true
  else
    printf "  \033[33m!\033[0m %s  \033[2m(got: %s)\033[0m\n" "$name" "$result"
    ((WARN++)) || true
  fi
}

echo ""
echo "=== Readable Self-Host Health Check ==="

# ── MongoDB ───────────────────────────────────────────────────────────────────
echo ""
echo "[ MongoDB ]"
_check "brew service started"  "started"   "brew services list | grep 'mongodb-community'"
_check "port 27017 open"       "ok"        "nc -z 127.0.0.1 27017 1>/dev/null 2>/dev/null && echo ok"

# ── Next.js App ───────────────────────────────────────────────────────────────
echo ""
echo "[ Next.js App — :3100 ]"
_check "PM2 process online"    "online"    "pm2 jlist 2>/dev/null | python3 -c \
  \"import sys,json; procs=json.load(sys.stdin); \
    [print(p['pm2_env']['status']) for p in procs if p['name']=='readable-app']\""
_check "PM2-managed (not orphan)" "readable-app" "pm2 jlist 2>/dev/null | python3 -c \
  \"import sys,json; procs=json.load(sys.stdin); \
    [print(p['name']) for p in procs if p['name']=='readable-app']\""
_check "port 3100 open"        "ok"        "nc -z 127.0.0.1 3100 1>/dev/null 2>/dev/null && echo ok"
_check "HTTP 200 on /"         "200"       "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100"

# ── MCP Server ────────────────────────────────────────────────────────────────
echo ""
echo "[ MCP Server — :8788 ]"
_check "PM2 process online"    "online"    "pm2 jlist 2>/dev/null | python3 -c \
  \"import sys,json; procs=json.load(sys.stdin); \
    [print(p['pm2_env']['status']) for p in procs if p['name']=='readable-mcp']\""
_check "port 8788 open"        "ok"        "nc -z 127.0.0.1 8788 1>/dev/null 2>/dev/null && echo ok"
_check "/health returns ok"    '"ok":true' "curl -s http://localhost:8788/health"
# Startup log shows the API base the MCP server resolved at launch
_check "API base → :3100"      "3100"      \
  "grep -o 'localhost:[0-9]*' \"\$HOME/.pm2/logs/readable-mcp-out.log\" 2>/dev/null | tail -1"

# ── cloudflared Tunnel ────────────────────────────────────────────────────────
echo ""
echo "[ cloudflared Tunnel ]"
_check "LaunchAgent loaded"    "com.readable.cloudflared" \
  "launchctl list 2>/dev/null | grep com.readable.cloudflared | awk '{print \$3}'"
_check "process running"       "ok"        "pgrep -x cloudflared > /dev/null && echo ok"
_check "4 connections"         "ok"        \
  "cloudflared tunnel info 36f0ab5f-f084-4d8e-982a-ca50bf263e80 2>/dev/null | grep -c 'CONNECTOR ID' | awk '{print (\$1>=1)?\"ok\":\"no-connections\"}'"

# ── PM2 persistence ───────────────────────────────────────────────────────────
echo ""
echo "[ PM2 Persistence ]"
_check "readable-app in dump"  "readable-app" \
  "python3 -c \"import json; procs=json.load(open('$HOME/.pm2/dump.pm2')); \
    [print(p.get('name')) for p in procs if p.get('name')=='readable-app']\" 2>/dev/null"
_check "readable-mcp in dump"  "readable-mcp" \
  "python3 -c \"import json; procs=json.load(open('$HOME/.pm2/dump.pm2')); \
    [print(p.get('name')) for p in procs if p.get('name')=='readable-mcp']\" 2>/dev/null"
_check "PM2 watchdog plist"    "com.readable.pm2" \
  "launchctl list 2>/dev/null | grep com.readable.pm2 | awk '{print \$3}'"

# ── Git hooks ─────────────────────────────────────────────────────────────────
echo ""
echo "[ Git Hooks ]"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || echo '')"
_check "hooksPath configured"  ".githooks" \
  "git -C '${REPO_ROOT:-.}' config core.hooksPath 2>/dev/null"
_check "pre-push hook exists"  "ok" \
  "[ -f '${REPO_ROOT:-.}/.githooks/pre-push' ] && echo ok"
_check "pre-push is executable" "ok" \
  "[ -x '${REPO_ROOT:-.}/.githooks/pre-push' ] && echo ok"

# ── Public Endpoints ──────────────────────────────────────────────────────────
echo ""
echo "[ Public Endpoints ]"
_check "readable domain"       "200"       "curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://readable.ashwinsathian.com"
_check "MCP domain /health"    '"ok":true' "curl -s --max-time 10 https://readable-mcp.ashwinsathian.com/health"
_warn  "cloudflared version"   "2026"      "cloudflared --version 2>&1 | head -1"

echo ""
echo "======================================"
printf "PASSED: \033[32m%d\033[0m  WARNED: \033[33m%d\033[0m  FAILED: \033[31m%d\033[0m\n" "$PASS" "$WARN" "$FAIL"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
