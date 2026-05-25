#!/usr/bin/env bash
# Run from anywhere: bash scripts/health-check.sh
# Exits 0 if all checks pass, 1 if any fail.
set -euo pipefail

PASS=0; FAIL=0

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

echo ""
echo "=== Readable Self-Host Health Check ==="

echo ""
echo "[ MongoDB ]"
_check "brew service started"  "started"   "brew services list | grep 'mongodb-community'"
_check "port 27017 open"       "ok"        "nc -z 127.0.0.1 27017 1>/dev/null 2>/dev/null && echo ok"

echo ""
echo "[ Next.js App ]"
_check "PM2 process online"    "online"    "pm2 jlist 2>/dev/null | python3 -c \
  \"import sys,json; procs=json.load(sys.stdin); \
    [print(p['pm2_env']['status']) for p in procs if p['name']=='readable-app']\""
_check "port 3100 open"        "ok"        "nc -z 127.0.0.1 3100 1>/dev/null 2>/dev/null && echo ok"
_check "HTTP 200 on /"         "200"       "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100"

echo ""
echo "[ MCP Server ]"
_check "PM2 process online"    "online"    "pm2 jlist 2>/dev/null | python3 -c \
  \"import sys,json; procs=json.load(sys.stdin); \
    [print(p['pm2_env']['status']) for p in procs if p['name']=='readable-mcp']\""
_check "port 8788 open"        "ok"        "nc -z 127.0.0.1 8788 1>/dev/null 2>/dev/null && echo ok"
_check "/health returns ok"    '"ok":true' "curl -s http://localhost:8788/health"

echo ""
echo "[ cloudflared Tunnel ]"
_check "process running"       "ok"        "pgrep -x cloudflared > /dev/null && echo ok"

echo ""
echo "[ Public Endpoints ]"
_check "readable domain"       "200"       "curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://readable.ashwinsathian.com"
_check "MCP domain /health"    '"ok":true' "curl -s --max-time 10 https://readable-mcp.ashwinsathian.com/health"

echo ""
echo "======================================"
printf "PASSED: \033[32m%d\033[0m  FAILED: \033[31m%d\033[0m\n" "$PASS" "$FAIL"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
