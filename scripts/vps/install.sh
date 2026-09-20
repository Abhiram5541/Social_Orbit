#!/usr/bin/env bash
# Idempotent server setup, run as the `senso` user on every deploy: cron entries
# for the backup and the healthcheck, and PM2 log rotation. Re-running replaces
# the managed cron block and leaves every other line alone.
set -euo pipefail
APP_DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
BIN="$APP_DIR/scripts/vps"
chmod +x "$BIN"/*.sh
mkdir -p /home/senso/logs /home/senso/backups/databases

begin='# >>> senso-managed >>>'
end='# <<< senso-managed <<<'
managed=$(cat <<CRON
$begin
PATH=/usr/local/bin:/usr/bin:/bin
30 2 * * * $BIN/backup-db.sh >> /home/senso/logs/backup.log 2>&1
*/5 * * * * $BIN/healthcheck.sh >> /home/senso/logs/health.log 2>&1
$end
CRON
)
current=$(crontab -l 2>/dev/null || true)
rest=$(printf '%s\n' "$current" | sed "/^$begin\$/,/^$end\$/d")
printf '%s\n%s\n' "$rest" "$managed" | sed '/^$/N;/^\n$/D' | crontab -

# 20MB per file, 14 files, compressed: bounded disk for a chatty week.
if ! pm2 ls 2>/dev/null | grep -q pm2-logrotate; then
  pm2 install pm2-logrotate >/dev/null
fi
pm2 set pm2-logrotate:max_size 20M >/dev/null
pm2 set pm2-logrotate:retain 14 >/dev/null
pm2 set pm2-logrotate:compress true >/dev/null
echo "vps: cron + logrotate installed"
