#!/usr/bin/env bash
# Proves a dump restores: loads it into a scratch database, counts the rows that
# matter, drops the scratch database. Never touches the live `senso` database.
# Run as root on the VPS (the app's database role may not create databases, so
# the scratch one is made and dropped as the postgres superuser):
#
#   scripts/vps/restore-drill.sh [dump]      default: the newest dump
set -euo pipefail
APP_DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
OUT_DIR=${OUT_DIR:-/home/senso/backups/databases}
cd /tmp
set -a; . "$APP_DIR/.env.production.local"; set +a

dump=${1:-$(ls -t "$OUT_DIR"/senso-*.dump | head -1)}
scratch="senso_restore_$(date -u +%s)"
scratch_url=${DATABASE_URL%/*}/$scratch
# The role in DATABASE_URL owns the scratch database so pg_restore needs no superuser.
role=$(sed -E 's#^[a-z]+://([^:/@]+).*#\1#' <<<"$DATABASE_URL")

sudo -u postgres createdb -O "$role" "$scratch"
trap 'sudo -u postgres dropdb --if-exists "$scratch"' EXIT
pg_restore --no-owner --role="$role" --dbname="$scratch_url" "$dump"
psql "$scratch_url" -tA <<SQL
SELECT 'creators: ' || count(*) FROM influencers;
SELECT 'app_state: ' || count(*) || ' rows across ' || count(DISTINCT kind) || ' kinds' FROM app_state;
SQL
echo "restore drill ok: $dump"
