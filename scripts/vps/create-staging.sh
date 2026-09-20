#!/usr/bin/env bash
# One-time: a staging site on the same VPS (CLAUDE.md D42). CloudPanel site +
# Let's Encrypt on the VPS hostname's subdomain (Hostinger resolves *.srv…
# without any DNS work), a `senso_staging` database restored from the newest
# backup, and an environment copied from production with the differences that
# make it staging: its own URL and database, no daily jobs (quota is spent
# once), no outbound mail, demo picker off. Idempotent where it can be.
# Run as root:  bash scripts/vps/create-staging.sh
set -euo pipefail
DOMAIN=staging.srv1082984.hstgr.cloud
SITE_USER=senso-staging
DIR=/home/$SITE_USER/htdocs/$DOMAIN
PROD=/home/senso/htdocs/srv1082984.hstgr.cloud
DUMP_DIR=/home/senso/backups/databases

if [ ! -d "/home/$SITE_USER/htdocs/$DOMAIN" ]; then
  clpctl site:add:nodejs --domainName="$DOMAIN" --nodejsVersion=20 --appPort=3015 \
    --siteUser="$SITE_USER" --siteUserPassword="$(openssl rand -base64 24 | tr -d '/+=')"
fi
clpctl lets-encrypt:install:certificate --domainName="$DOMAIN" || echo "certificate: retry later if DNS was slow"

# The staging tree is built and run as `senso`, like production, so one PM2
# daemon holds both apps.
mkdir -p "$DIR" && chown -R senso:senso "$DIR" && chmod 755 "/home/$SITE_USER" "/home/$SITE_USER/htdocs"

cd /tmp
set -a; . "$PROD/.env.production.local"; set +a
role=$(sed -E 's#^[a-z]+://([^:/@]+).*#\1#' <<<"$DATABASE_URL")
if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname='senso_staging'" | grep -q 1; then
  sudo -u postgres createdb -O "$role" senso_staging
  latest=$(ls -t "$DUMP_DIR"/senso-*.dump | head -1)
  sudo -u senso pg_restore --no-owner --role="$role" --dbname="${DATABASE_URL%/*}/senso_staging" "$latest"
  echo "restored $latest into senso_staging"
fi

env_file="$DIR/.env.production.local"
if [ ! -f "$env_file" ]; then
  sed -E \
    -e "s#^(DATABASE_URL=.*)/[A-Za-z0-9_]+(\"?)\$#\1/senso_staging\2#" \
    -e "s#^APP_URL=.*#APP_URL=https://$DOMAIN#" \
    -e "s#^SOCIALORBIT_DAILY_JOBS=.*#SOCIALORBIT_DAILY_JOBS=false#" \
    -e "s#^SOCIALORBIT_DEMO_LOGINS=.*#SOCIALORBIT_DEMO_LOGINS=false#" \
    -e "s#^RESEND_API_KEY=.*#RESEND_API_KEY=#" \
    "$PROD/.env.production.local" > "$env_file"
  chown senso:senso "$env_file" && chmod 600 "$env_file"
  echo "wrote $env_file"
fi
grep -E '^(APP_URL|SOCIALORBIT_DAILY_JOBS|RESEND_API_KEY)=' "$env_file"
echo "staging ready for: SENSO_TARGET=staging scripts/deploy-vps.sh <ref>"
