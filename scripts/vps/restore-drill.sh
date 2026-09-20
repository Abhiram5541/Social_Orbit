#!/usr/bin/env bash
# Proves a dump restores: loads it into a scratch database, counts the rows that
# matter, drops the scratch database. Never touches the live `senso` database.
#
# Usage: scripts/vps/restore-drill.sh [dump]   (default: the newest dump)
set -euo pipefail
APP_DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
OUT_DIR=${OUT_DIR:-/home/senso/backups/databases}
set -a; . "$APP_DIR/.env.production.local"; set +a

dump=${1:-$(ls -t "$OUT_DIR"/senso-*.dump | head -1)}
scratch="senso_restore_$(date -u +%s)"
# Same server and credentials as the live database, different database name.
admin_url=${DATABASE_URL%/*}/postgres
scratch_url=${DATABASE_URL%/*}/$scratch

psql "$admin_url" -qc "CREATE DATABASE \"$scratch\""
trap 'psql "$admin_url" -qc "DROP DATABASE IF EXISTS \"$scratch\""' EXIT
pg_restore --no-owner --dbname="$scratch_url" "$dump"
psql "$scratch_url" -tA <<SQL
SELECT 'creators: ' || count(*) FROM influencers;
SELECT 'app_state: ' || count(*) || ' rows across ' || count(DISTINCT kind) || ' kinds' FROM app_state;
SQL
echo "restore drill ok: $dump"
