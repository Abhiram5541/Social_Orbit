#!/usr/bin/env bash
# Retires the development sign-ins on a production server: every seed account
# gets a random password, the demo login picker is turned off and
# DEV_SEED_PASSWORD is dropped from the environment. The new passwords are
# written to /root/senso-accounts.txt (root-only) — move them into a password
# manager and delete the file. Run as root on the VPS:
#
#   bash /home/senso/htdocs/srv1082984.hstgr.cloud/scripts/vps/rotate-accounts.sh
set -euo pipefail
DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
ENV="$DIR/.env.production.local"
APP=${APP_URL_LOCAL:-http://127.0.0.1:3005}
OUT=${OUT:-/root/senso-accounts.txt}

seed=$(grep -E '^DEV_SEED_PASSWORD=' "$ENV" | cut -d= -f2- | tr -d '"' || true)
[ -n "$seed" ] || { echo "DEV_SEED_PASSWORD is already gone; nothing to rotate with."; exit 0; }

jar=$(mktemp)
trap 'rm -f "$jar"' EXIT
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$jar" -H 'content-type: application/json' \
  -d "{\"email\":\"admin@senso360.com\",\"password\":\"$seed\"}" "$APP/api/internal/auth/login")
[ "$code" = 200 ] || { echo "admin sign-in with the seed password failed ($code)"; exit 1; }

umask 077
{
  echo "# SENSO accounts — rotated $(date -u +%FT%TZ). Move these to a password manager, then delete this file."
  curl -s -b "$jar" "$APP/api/internal/admin/users" | node -e '
    const users = JSON.parse(require("fs").readFileSync(0, "utf8"));
    for (const u of users) console.log(`${u.id}\t${u.email}\t${u.role}`);
  ' | while IFS=$'\t' read -r id email role; do
    pw=$(openssl rand -base64 27 | tr -d '/+=' | cut -c1-24)
    r=$(curl -s -o /dev/null -w '%{http_code}' -b "$jar" -H 'content-type: application/json' \
      -d "{\"userId\":\"$id\",\"password\":\"$pw\"}" "$APP/api/internal/admin/users")
    if [ "$r" = 200 ]; then echo "$email ($role): $pw"; else echo "$email ($role): ROTATION FAILED ($r)"; fi
  done
} > "$OUT"

sed -i -E 's/^SOCIALORBIT_DEMO_LOGINS=.*/SOCIALORBIT_DEMO_LOGINS=false/; /^DEV_SEED_PASSWORD=/d' "$ENV"
sudo -u senso pm2 restart senso --update-env >/dev/null
sleep 6
curl -s -o /dev/null -w "app after restart: %{http_code}\n" "$APP/api/internal/health"
echo "rotated $(grep -c ': ' "$OUT") accounts → $OUT ($(grep -c FAILED "$OUT" || true) failed)"
