#!/usr/bin/env bash
# Copies the newest database dump from the VPS to this machine — the off-box
# copy until an rclone remote is configured on the server. Run it weekly.
# Usage: scripts/pull-backup.sh [dest]   default ~/SENSO-backups
set -euo pipefail
HOST=${SENSO_VPS_HOST:-168.231.120.57}
DEST=${1:-$HOME/SENSO-backups}
mkdir -p "$DEST"
latest=$(ssh -i "$HOME/.ssh/senso_vps" "root@$HOST" 'ls -t /home/senso/backups/databases/senso-*.dump 2>/dev/null | head -1')
[ -n "$latest" ] || { echo "no dump on the server yet (the nightly job runs at 02:30 UTC)"; exit 1; }
rsync -az -e "ssh -i $HOME/.ssh/senso_vps" "root@$HOST:$latest" "$DEST/"
echo "pulled $(basename "$latest") → $DEST"
