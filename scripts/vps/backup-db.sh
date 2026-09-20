#!/usr/bin/env bash
# Nightly PostgreSQL backup for the SENSO VPS. Runs as the `senso` user from cron
# (installed by scripts/vps/install.sh). Keeps 30 daily dumps locally and, when an
# rclone remote named `senso-backups` exists, copies each dump off the box too.
#
# Restore: scripts/vps/restore-drill.sh <dump>   (verifies into a scratch database)
#          pg_restore --clean --if-exists -d "$DATABASE_URL" <dump>   (for real)
set -euo pipefail
APP_DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
OUT_DIR=${OUT_DIR:-/home/senso/backups/databases}
KEEP_DAYS=${KEEP_DAYS:-30}

set -a; . "$APP_DIR/.env.production.local"; set +a
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

stamp=$(date -u +%Y%m%d-%H%M)
file="$OUT_DIR/senso-$stamp.dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$file.part"
mv "$file.part" "$file"
find "$OUT_DIR" -name 'senso-*.dump' -mtime +"$KEEP_DAYS" -delete

size=$(du -h "$file" | cut -f1)
offbox="local only"
if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -q '^senso-backups:'; then
  rclone copy "$file" senso-backups:senso/databases/ --quiet && offbox="copied to senso-backups"
fi
echo "$(date -u +%FT%TZ) backup $file ($size) — $offbox"
