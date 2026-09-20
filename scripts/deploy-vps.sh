#!/usr/bin/env bash
# Deploys a git ref to the Hostinger VPS: exports it with `git archive` (so
# nothing uncommitted ships), rsyncs the export, builds on the server, runs the
# idempotent server setup (scripts/vps/install.sh: backup + healthcheck cron,
# PM2 log rotation) and restarts. Secrets live only on the server
# (.env.production.local) and are never synced.
#
# Usage: scripts/deploy-vps.sh [ref]        default HEAD; a tag is the norm
#        ALLOW_DIRTY=1 scripts/deploy-vps.sh  ship HEAD with uncommitted changes
# Needs: ~/.ssh/senso_vps authorised for root@HOST.
set -euo pipefail
HOST=${SENSO_VPS_HOST:-168.231.120.57}
DIR=/home/senso/htdocs/srv1082984.hstgr.cloud
SSH="ssh -i $HOME/.ssh/senso_vps root@$HOST"
REF=${1:-HEAD}

if [ "$REF" = HEAD ] && [ -n "$(git status --porcelain --untracked-files=no)" ] && [ "${ALLOW_DIRTY:-}" != 1 ]; then
  echo "deploy: the working tree has uncommitted changes. Commit them, or ALLOW_DIRTY=1 to ship them anyway." >&2
  exit 1
fi

SHA=$(git rev-parse --short "$REF")
DESC=$(git describe --tags --always "$REF")
EXPORT=$(mktemp -d)
trap 'rm -rf "$EXPORT"' EXIT
git archive --format=tar "$REF" | tar -x -C "$EXPORT"
printf '%s %s %s\n' "$DESC" "$SHA" "$(date -u +%FT%TZ)" > "$EXPORT/DEPLOY_SHA"
echo "deploy: $DESC ($SHA) → $HOST"

rsync -az --delete -e "ssh -i $HOME/.ssh/senso_vps" \
  --exclude node_modules --exclude .next --exclude .data --exclude .git \
  --exclude test-results --exclude playwright-report --exclude ".env*" \
  --exclude "scripts/seeds/*.cursor" \
  "$EXPORT/" "root@$HOST:$DIR/"

$SSH "cd $DIR && npm ci --no-audit --no-fund && NODE_OPTIONS=--max-old-space-size=3072 npm run build && chown -R senso:senso . && sudo -u senso bash -c 'cd $DIR && scripts/vps/install.sh' && sudo -u senso pm2 restart senso --update-env"
$SSH "sleep 6; curl -s -o /dev/null -w 'app: %{http_code}\n' http://127.0.0.1:3005/api/internal/health; cat $DIR/DEPLOY_SHA"
