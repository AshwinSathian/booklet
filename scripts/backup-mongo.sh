#!/usr/bin/env bash
# =============================================================================
# backup-mongo.sh — nightly backup of the Booklet database.
#
#   mongodump (gzip archive) → age (public-key encryption) → rclone → R2
#
# With no configuration at all it still runs: a plain gzip archive goes to
# ~/.booklet/backups on this Mac. That copy survives a bad migration or an
# accidental delete. It does not survive the loss of this disk; only the
# off-site form above does.
#
# The archive is encrypted on this machine with an age PUBLIC key before it
# leaves it. The matching private key is not on this machine's backup path
# at all: a stolen R2 token or bucket exposes ciphertext only. Restoring
# needs the private key — see docs/OPERATIONS.md, "Backups and restore".
#
# Scheduled by launchd (scripts/com.booklet.backup.plist), 03:30 local time.
# Run by hand at any time:  bash scripts/backup-mongo.sh
#
# Configuration: ~/.booklet/backup.env (chmod 600), sourced below.
#   BACKUP_AGE_RECIPIENT   age public key, "age1…". Required unless
#                          BACKUP_REMOTE is a directory on this Mac.
#   BACKUP_REMOTE          rclone destination, "remote:bucket", or a local
#                          directory. Default: ~/.booklet/backups
#   MONGODB_URI            defaults to the local production database
#   BACKUP_KEEP            archives to keep, default 30
#   BACKUP_ALERT_EMAIL     where a failure is reported            (optional)
#   RESEND_API_KEY         needed to send that email              (optional)
#   EMAIL_FROM_ADDRESS     defaults to the app's own sender
#   RCLONE_CONFIG_*        rclone remote definition via env vars, if the
#                          remote is not in rclone's own config file
# =============================================================================
set -euo pipefail

# launchd starts jobs with a minimal PATH that has no Homebrew in it.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ENV_FILE="${BOOKLET_BACKUP_ENV:-$HOME/.booklet/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/booklet?directConnection=true}"
BACKUP_KEEP="${BACKUP_KEEP:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_REMOTE="${BACKUP_REMOTE:-$HOME/.booklet/backups}"
NAME="booklet-${STAMP}.archive.gz${BACKUP_AGE_RECIPIENT:+.age}"
WORK="$(mktemp -d)"
chmod 700 "$WORK"

log() { echo "[$(date +%H:%M:%S)] $*"; }

notify_failure() {
  local step="$1"
  log "BACKUP FAILED at: $step"
  if [[ -n "${BACKUP_ALERT_EMAIL:-}" && -n "${RESEND_API_KEY:-}" ]]; then
    # Body built by python so the step text is JSON-escaped, not interpolated.
    python3 - "$step" "$BACKUP_ALERT_EMAIL" "${EMAIL_FROM_ADDRESS:-Booklet <noreply@booklet.ashwinsathian.com>}" <<'PY' |
import json, socket, sys
step, to, sender = sys.argv[1:4]
print(json.dumps({
    "from": sender,
    "to": [to],
    "subject": "Booklet backup FAILED",
    "text": f"The nightly Booklet backup failed on {socket.gethostname()} at step: {step}\n\n"
            "Log: ~/.booklet-deploy-logs/backup.log\n"
            "Runbook: docs/OPERATIONS.md, \"Backups and restore\".",
}))
PY
      curl -sS --max-time 20 -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer ${RESEND_API_KEY}" \
        -H "Content-Type: application/json" \
        --data-binary @- >/dev/null || log "Could not send the failure email either."
  else
    log "No failure email sent: BACKUP_ALERT_EMAIL or RESEND_API_KEY is unset."
  fi
}

STEP="starting"
cleanup() {
  local code=$?
  rm -rf "$WORK"
  if [[ $code -ne 0 ]]; then notify_failure "$STEP"; fi
  exit $code
}
trap cleanup EXIT

STEP="checking configuration"
# An rclone remote is "name:path"; anything starting with / is this Mac.
if [[ "$BACKUP_REMOTE" == /* ]]; then
  mkdir -p "$BACKUP_REMOTE"
  chmod 700 "$BACKUP_REMOTE"
elif [[ -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  log "BACKUP_AGE_RECIPIENT is not set: refusing to send an unencrypted archive to $BACKUP_REMOTE."
  exit 1
fi
for bin in mongodump rclone ${BACKUP_AGE_RECIPIENT:+age}; do
  command -v "$bin" >/dev/null || { log "$bin is not installed (brew install $bin)"; exit 1; }
done

STEP="mongodump | age"
log "Dumping → $NAME"
# pipefail (set above) makes a mongodump failure fail the pipeline, so a
# truncated dump is never uploaded as if it were a good archive.
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  mongodump --uri="$MONGODB_URI" --archive --gzip --quiet \
    | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$WORK/$NAME"
else
  mongodump --uri="$MONGODB_URI" --archive="$WORK/$NAME" --gzip --quiet
fi

SIZE=$(wc -c < "$WORK/$NAME" | tr -d ' ')
# An age file with an empty payload is ~200 bytes; a real dump of even an
# empty database is larger. Anything this small means the dump produced
# nothing.
if [[ "$SIZE" -lt 1024 ]]; then
  log "Archive is only $SIZE bytes — refusing to upload it."
  exit 1
fi

STEP="rclone upload"
log "Uploading $SIZE bytes to $BACKUP_REMOTE"
rclone copyto "$WORK/$NAME" "$BACKUP_REMOTE/$NAME"

STEP="verifying upload"
REMOTE_SIZE=$(rclone size --json "$BACKUP_REMOTE/$NAME" | python3 -c 'import json,sys; print(json.load(sys.stdin)["bytes"])')
if [[ "$REMOTE_SIZE" != "$SIZE" ]]; then
  log "Remote size $REMOTE_SIZE does not match local size $SIZE."
  exit 1
fi

STEP="pruning old archives"
# Count-based, not age-based: if backups stop for a month, an age-based
# prune run after the next success would delete every older archive.
# Names sort chronologically (UTC timestamp), so "all but the last N" is
# "all but the newest N".
rclone lsf --files-only --include "booklet-*.archive.gz*" "$BACKUP_REMOTE" | sort \
  | awk -v keep="$BACKUP_KEEP" '{ a[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print a[i] }' \
  | while IFS= read -r old; do
      log "Pruning $old"
      rclone deletefile "$BACKUP_REMOTE/$old"
    done

STEP="rotating the MongoDB log"
# mongod never rotates its own log; it had reached 339 MB by 2026-10.
# logRotate renames the current file with a timestamp and starts a new one.
MONGO_LOG_DIR="${MONGO_LOG_DIR:-/opt/homebrew/var/log/mongodb}"
if command -v mongosh >/dev/null && mongosh "$MONGODB_URI" --quiet --eval 'db.adminCommand({ logRotate: 1 })' >/dev/null; then
  find "$MONGO_LOG_DIR" -name 'mongo.log.*' -mtime +14 -delete 2>/dev/null || true
else
  log "Could not rotate the MongoDB log (the backup itself is fine)."
fi

STEP="done"
log "Backup complete: $BACKUP_REMOTE/$NAME"
