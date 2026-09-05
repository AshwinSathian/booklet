#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-from-atlas.sh
#
# Dumps every collection from MongoDB Atlas and restores them into the local
# MongoDB instance, preserving all _id values so existing public URLs continue
# to resolve without change.
#
# Usage:
#   bash scripts/migrate-from-atlas.sh [ATLAS_URI]
#
#   ATLAS_URI can also be passed as an environment variable:
#   ATLAS_URI="mongodb+srv://..." bash scripts/migrate-from-atlas.sh
#
# What it does:
#   1. Validates prerequisites (mongodump, mongorestore, nc)
#   2. Dumps the 'booklet' database from Atlas to a timestamped temp dir
#   3. Restores each collection into the local MongoDB, skipping rate_limits
#      (ephemeral) and using --drop to get an exact replica of Atlas
#   4. Re-runs index setup to ensure all indexes are present
#   5. Prints a collection-level document count diff (Atlas vs local)
#
# Idempotent: safe to re-run. Each run creates a fresh dump dir and restores
# from scratch (existing local data is replaced, not merged).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()      { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
die()     { printf "${RED}[error]${RESET} %s\n" "$*" >&2; exit 1; }
section() { printf "\n${BOLD}── %s ──${RESET}\n" "$*"; }

# ── Resolve Atlas URI ─────────────────────────────────────────────────────────
if [[ -n "${1:-}" ]]; then
  warn "Atlas URI passed as a command-line argument — on a shared machine this is" \
       "visible to other local users via 'ps'/'/proc' for the life of this process." \
       "Prefer the ATLAS_URI env var or the interactive prompt instead."
fi
ATLAS_URI="${1:-${ATLAS_URI:-}}"

if [[ -z "$ATLAS_URI" ]]; then
  printf "${BOLD}MongoDB Atlas URI:${RESET} "
  read -r -s ATLAS_URI
  echo
fi

[[ -z "$ATLAS_URI" ]] && die "Atlas URI is required."
[[ "$ATLAS_URI" != mongodb* ]] && die "URI must start with mongodb:// or mongodb+srv://"

# ── Config ────────────────────────────────────────────────────────────────────
LOCAL_URI="mongodb://127.0.0.1:27017/booklet?directConnection=true"
DB_NAME="booklet"
DUMP_DIR="/tmp/booklet-atlas-dump-$(date +%Y%m%d-%H%M%S)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Collections to skip — either ephemeral or safe to leave empty
SKIP_COLLECTIONS=("rate_limits")

# ── Prerequisites ─────────────────────────────────────────────────────────────
section "Checking prerequisites"

for cmd in mongodump mongorestore mongosh; do
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd found at $(command -v "$cmd")"
  else
    die "$cmd not found. Install with: brew install mongodb-database-tools"
  fi
done

nc -z 127.0.0.1 27017 1>/dev/null 2>/dev/null \
  || die "Local MongoDB is not running on port 27017. Start it with: brew services start mongodb-community@8.0"
ok "Local MongoDB reachable at 127.0.0.1:27017"

# ── Verify Atlas connectivity ─────────────────────────────────────────────────
section "Verifying Atlas connectivity"
info "Connecting to Atlas (this may take a few seconds)…"

ATLAS_COLLECTIONS=$(mongosh "$ATLAS_URI" --quiet --eval \
  "db.getSiblingDB('${DB_NAME}').getCollectionNames().join(',')" 2>/dev/null) \
  || die "Could not connect to Atlas. Check your URI and network access settings."

ok "Connected. Collections found: $ATLAS_COLLECTIONS"

# ── Dump from Atlas ───────────────────────────────────────────────────────────
section "Dumping from Atlas"
info "Dump directory: $DUMP_DIR"
# 0700: this dump contains the full production DB (users, api_keys, sessions)
# in plaintext BSON — must not be world/group-readable on a shared machine.
mkdir -m 700 -p "$DUMP_DIR"

# Build the --excludeCollection flags for skipped collections
EXCLUDE_FLAGS=()
for col in "${SKIP_COLLECTIONS[@]}"; do
  EXCLUDE_FLAGS+=("--excludeCollection=$col")
done

info "Running mongodump (this may take a minute)…"
mongodump \
  --uri="$ATLAS_URI" \
  --db="$DB_NAME" \
  --out="$DUMP_DIR" \
  --numParallelCollections=4 \
  "${EXCLUDE_FLAGS[@]}" \
  2>&1 | grep -E "done dumping|writing|error" | while IFS= read -r line; do
    info "  $line"
  done

# Count what was dumped
DUMPED_FILES=$(find "$DUMP_DIR/$DB_NAME" -name "*.bson" 2>/dev/null | wc -l | tr -d ' ')
ok "Dumped $DUMPED_FILES collections to $DUMP_DIR"

# ── Pre-migration counts from Atlas ──────────────────────────────────────────
# Store as a TSV in a temp file (bash 3 compatible — no associative arrays)
section "Atlas document counts (before restore)"
ATLAS_COUNTS_FILE=$(mktemp)
mongosh "$ATLAS_URI" --quiet --eval "
  db.getSiblingDB('${DB_NAME}').getCollectionNames().forEach(c => {
    print(c + '\t' + db.getSiblingDB('${DB_NAME}').getCollection(c).countDocuments());
  });
" 2>/dev/null > "$ATLAS_COUNTS_FILE"
while IFS=$'\t' read -r col count; do
  printf "  %-30s %s docs\n" "$col" "$count"
done < "$ATLAS_COUNTS_FILE"

# ── Restore to local ──────────────────────────────────────────────────────────
section "Restoring to local MongoDB"
info "Using --drop: existing local collections will be replaced with Atlas data."
warn "This is intentional — Atlas is the source of truth for this migration."

mongorestore \
  --uri="$LOCAL_URI" \
  --db="$DB_NAME" \
  --drop \
  --numParallelCollections=4 \
  "$DUMP_DIR/$DB_NAME" \
  2>&1 | grep -E "restoring|finished|error|document" | while IFS= read -r line; do
    info "  $line"
  done

ok "Restore complete"

# ── Re-run index setup ────────────────────────────────────────────────────────
section "Ensuring indexes are present"
MONGODB_URI="$LOCAL_URI" node "$REPO_ROOT/scripts/setup-mongodb.mjs" 2>&1 \
  && ok "Indexes verified" \
  || warn "Index setup returned non-zero — check manually if indexes are correct"

# ── Post-restore counts (local) ───────────────────────────────────────────────
section "Post-restore document counts (local vs Atlas)"

printf "\n  %-30s %10s %10s %s\n" "COLLECTION" "LOCAL" "ATLAS" "MATCH"
printf "  %-30s %10s %10s %s\n" "──────────" "─────" "─────" "─────"

MISMATCH=0
while IFS=$'\t' read -r col local_count; do
  # Look up the Atlas count from our temp file
  atlas_count=$(awk -F'\t' -v c="$col" '$1==c{print $2}' "$ATLAS_COUNTS_FILE")
  atlas_count="${atlas_count:-skipped}"
  if [[ "$atlas_count" == "skipped" ]]; then
    printf "  %-30s %10s %10s %s\n" "$col" "$local_count" "skipped" "—"
  elif [[ "$local_count" == "$atlas_count" ]]; then
    printf "  ${GREEN}%-30s %10s %10s ✓${RESET}\n" "$col" "$local_count" "$atlas_count"
  else
    printf "  ${YELLOW}%-30s %10s %10s ≠${RESET}\n" "$col" "$local_count" "$atlas_count"
    ((MISMATCH++)) || true
  fi
done < <(mongosh "$LOCAL_URI" --quiet --eval "
  db.getCollectionNames().forEach(c => {
    print(c + '\t' + db.getCollection(c).countDocuments());
  });
" 2>/dev/null)
rm -f "$ATLAS_COUNTS_FILE"

echo ""
if [[ $MISMATCH -eq 0 ]]; then
  ok "All collection counts match Atlas ✓"
else
  warn "$MISMATCH collection(s) have count mismatches — usually benign (TTL docs may have expired)"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
section "Cleanup"
warn "Dump files kept at: $DUMP_DIR (mode 700, but still a plaintext copy of the" \
     "full production DB — including users, api_keys, and sessions)."
info "Remove once confirmed: rm -rf $DUMP_DIR"

echo ""
printf "${GREEN}${BOLD}Migration complete.${RESET}\n"
printf "All existing page links, API keys, and user data have been copied from Atlas.\n"
printf "Your local server is now running the full production dataset.\n\n"
