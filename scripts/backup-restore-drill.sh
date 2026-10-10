#!/usr/bin/env bash
# =============================================================================
# backup-restore-drill.sh — prove the newest backup can actually be restored.
#
# Takes the newest archive from BACKUP_REMOTE (default: ~/.booklet/backups),
# decrypts it with the age PRIVATE key if it is encrypted, restores it into
# a scratch database (never the live one), and prints the
# pages / docs / users counts for the restored copy next to production's.
# Matching counts are the pass condition. The scratch database is dropped at
# the end.
#
#   bash scripts/backup-restore-drill.sh -                              (local, unencrypted)
#   bash scripts/backup-restore-drill.sh /path/to/age-private-key.txt   (encrypted)
#
# Counts differ legitimately if anything was published between the backup
# and the drill — run it right after `bash scripts/backup-mongo.sh` for a
# clean comparison.
#
# The same three commands, pointed at the real database name, are the
# disaster-recovery restore — see docs/OPERATIONS.md, "Backups and restore".
# =============================================================================
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# The identity file is only needed for an encrypted (.age) archive. For the
# local unencrypted form pass "-" in its place.
IDENTITY="${1:?usage: backup-restore-drill.sh <age-private-key-file | -> [archive-name]}"

ENV_FILE="${BOOKLET_BACKUP_ENV:-$HOME/.booklet/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
BACKUP_REMOTE="${BACKUP_REMOTE:-$HOME/.booklet/backups}"

MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/booklet?directConnection=true}"
SCRATCH_DB="booklet_restore_drill"
# Same server, two URIs: one naming the scratch database (for mongosh), one
# naming no database at all (for mongorestore — given a database in its URI
# it restores only namespaces already in that database, which silently
# matches nothing in an archive of "booklet.*").
with_db() {
  python3 - "$MONGODB_URI" "$1" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
uri, db = sys.argv[1:3]
p = urlsplit(uri)
print(urlunsplit((p.scheme, p.netloc, "/" + db, p.query, p.fragment)))
PY
}
SCRATCH_URI="$(with_db "$SCRATCH_DB")"
SERVER_URI="$(with_db "")"

ARCHIVE="${2:-$(rclone lsf --files-only --include "booklet-*.archive.gz" --include "booklet-*.archive.gz.age" "$BACKUP_REMOTE" | sort | tail -1)}"
[[ -n "$ARCHIVE" ]] || { echo "No archives found in $BACKUP_REMOTE" >&2; exit 1; }
if [[ "$ARCHIVE" == *.age && ! -r "$IDENTITY" ]]; then
  echo "Cannot read age identity file: $IDENTITY" >&2
  exit 1
fi
echo "Restoring $BACKUP_REMOTE/$ARCHIVE into scratch database \"$SCRATCH_DB\""

cleanup() { mongosh "$SCRATCH_URI" --quiet --eval 'db.dropDatabase()' >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

decrypt() {
  if [[ "$ARCHIVE" == *.age ]]; then
    age --decrypt --identity "$IDENTITY"
  else
    cat
  fi
}

rclone cat "$BACKUP_REMOTE/$ARCHIVE" \
  | decrypt \
  | mongorestore --uri="$SERVER_URI" --archive --gzip --quiet \
      --nsFrom='booklet.*' --nsTo="${SCRATCH_DB}.*"

counts() {
  mongosh "$1" --quiet --eval \
    '["pages","docs","users"].map((c) => c + "=" + db.getCollection(c).countDocuments({})).join(" ")'
}
RESTORED="$(counts "$SCRATCH_URI")"
LIVE="$(counts "$MONGODB_URI")"
echo "restored:   $RESTORED"
echo "production: $LIVE"
if [[ "$RESTORED" == "$LIVE" ]]; then
  echo "PASS — counts match."
else
  echo "MISMATCH — see the note at the top of this script before treating this as a failure."
  exit 1
fi
