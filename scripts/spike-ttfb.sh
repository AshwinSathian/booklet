#!/usr/bin/env bash
# Spike S0: time to first byte for /, /p/<id> and POST /api/v1/publish.
# 200 sequential requests per target, a new connection for each (so DNS, TCP
# and TLS are included, as a first-time visitor pays them).
#
#   BASE=https://booklet.ashwinsathian.com API_KEY=... bash scripts/spike-ttfb.sh out-dir
#
# Publishes 201 small pages tagged "s0-ttfb" and deletes every one of them
# before exiting, including on failure.
set -uo pipefail

OUT="${1:?usage: spike-ttfb.sh <out dir>}"
: "${BASE:?BASE is required}" "${API_KEY:?API_KEY is required}"
N="${N:-200}"
mkdir -p "$OUT"
IDS="$OUT/published-ids.txt"
: > "$IDS"

cleanup() {
  local deleted=0
  while read -r id; do
    [[ -z "$id" ]] && continue
    code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/pages/$id" -H "Authorization: Bearer $API_KEY")
    [[ "$code" == 2* ]] && deleted=$((deleted + 1))
    sleep 1.1
  done < "$IDS"
  echo "cleanup: deleted $deleted of $(grep -c . "$IDS") published pages"
}
trap cleanup EXIT

publish() { # prints "<ttfb seconds> <http code> <id>"
  local body
  body=$(curl -s -w '\n%{time_starttransfer} %{http_code}' -X POST "$BASE/api/v1/publish" \
    -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
    -d '{"raw":"# s0-ttfb\n\nBaseline measurement page. Safe to delete.\n\n- one\n- two","title":"s0-ttfb"}')
  local id
  id=$(sed -n '1p' <<<"$body" | grep -oE '"id":"[^"]+"' | cut -d'"' -f4)
  echo "$(sed -n '$p' <<<"$body") $id"
}

# Nearest-rank percentile over the 200-status samples in a "<seconds> <code>" file.
stats() {
  awk '$2 ~ /^2/ {print $1}' "$2" | sort -n | awk -v name="$1" -v total="$(grep -c . "$2")" '
    {a[NR] = $1}
    END {
      if (NR == 0) { printf "%s: no successful samples of %d\n", name, total; exit }
      p50 = a[int((NR * 0.50) + 0.999999)]; p95 = a[int((NR * 0.95) + 0.999999)]
      printf "%s: n=%d ok=%d p50=%.0f ms p95=%.0f ms min=%.0f ms max=%.0f ms\n", name, total, NR, p50 * 1000, p95 * 1000, a[1] * 1000, a[NR] * 1000
    }'
}

read -r _ code PAGE_ID < <(publish)
if [[ "$code" != 2* || -z "$PAGE_ID" ]]; then echo "could not publish the share page (HTTP $code)"; exit 1; fi
echo "$PAGE_ID" >> "$IDS"

for i in $(seq 1 "$N"); do curl -s -o /dev/null -w '%{time_starttransfer} %{http_code}\n' "$BASE/"; done > "$OUT/home.txt"
for i in $(seq 1 "$N"); do curl -s -o /dev/null -w '%{time_starttransfer} %{http_code}\n' "$BASE/p/$PAGE_ID"; done > "$OUT/share.txt"
# The v1 publish limit is 60 per minute per user: one request every 1.1 s.
for i in $(seq 1 "$N"); do
  read -r t code id < <(publish)
  echo "$t $code" >> "$OUT/publish.txt"
  [[ -n "$id" ]] && echo "$id" >> "$IDS"
  sleep 1.1
done

{
  echo "base: $BASE"
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "vantage: $(curl -s https://www.cloudflare.com/cdn-cgi/trace | grep -E '^(colo|loc)=' | tr '\n' ' ')"
  stats "GET /" "$OUT/home.txt"
  stats "GET /p/<id>" "$OUT/share.txt"
  stats "POST /api/v1/publish" "$OUT/publish.txt"
} | tee "$OUT/summary.txt"
