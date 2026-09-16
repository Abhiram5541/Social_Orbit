#!/usr/bin/env bash
# Deploys the working tree to the Hostinger VPS: rsync source, build, restart.
# Secrets live only on the server (.env.production.local) and are never synced.
#
# Usage: scripts/deploy-vps.sh
# Needs: ~/.ssh/senso_vps authorised for root@HOST.
set -euo pipefail
HOST=${SENSO_VPS_HOST:-168.231.120.57}
DIR=/home/senso/htdocs/srv1082984.hstgr.cloud
SSH="ssh -i $HOME/.ssh/senso_vps root@$HOST"

rsync -az --delete -e "ssh -i $HOME/.ssh/senso_vps" \
  --exclude node_modules --exclude .next --exclude .data --exclude .git \
  --exclude test-results --exclude playwright-report --exclude ".env*" \
  --exclude .claude --exclude .agents --exclude "docs/*.docx" \
  ./ "root@$HOST:$DIR/"

$SSH "cd $DIR && npm ci --no-audit --no-fund && NODE_OPTIONS=--max-old-space-size=3072 npm run build && chown -R senso:senso . && sudo -u senso pm2 restart senso --update-env"
$SSH "sleep 6; curl -s -o /dev/null -w 'app: %{http_code}\n' http://127.0.0.1:3005/"
