#!/usr/bin/env bash
# Every five minutes from cron: is the app answering? Two consecutive failures
# restart it under PM2 and post to the ops Slack channel (SLACK_WEBHOOK_URL);
# the first success afterwards posts the recovery. Nothing to install, nothing
# to sign up for. Pair it with an external monitor (UptimeRobot or similar) that
# would also notice the whole VPS going away.
set -uo pipefail
APP_DIR=${APP_DIR:-/home/senso/htdocs/srv1082984.hstgr.cloud}
URL=${HEALTH_URL:-http://127.0.0.1:3005/api/internal/health}
STATE=${STATE_FILE:-/home/senso/.senso-health}

set -a; . "$APP_DIR/.env.production.local"; set +a
notify() {
  [ -n "${SLACK_WEBHOOK_URL:-}" ] || return 0
  curl -s -m 10 -X POST -H 'content-type: application/json' \
    -d "$(printf '{"text":"%s"}' "$1")" "$SLACK_WEBHOOK_URL" >/dev/null || true
}

code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$URL" || echo 000)
fails=$(cat "$STATE" 2>/dev/null || echo 0)

if [ "$code" = "200" ]; then
  if [ "$fails" -ge 2 ]; then notify ":white_check_mark: SENSO is answering again ($URL)"; fi
  echo 0 > "$STATE"
  # Capacity: the whole database is resident (CLAUDE.md D42). Warn once a day
  # when the process nears the heap limit or the read model nears its measured
  # ceiling, while there is still time to move reads to SQL.
  body=$(curl -s -m 15 "$URL" || echo '{}')
  mem=$(printf '%s' "$body" | sed -n 's/.*"memoryMb":\([0-9]*\).*/\1/p')
  creators=$(printf '%s' "$body" | sed -n 's/.*"creators":\([0-9]*\).*/\1/p')
  stamp=/home/senso/.senso-capacity-warned
  if { [ "${mem:-0}" -gt 3000 ] || [ "${creators:-0}" -gt 25000 ]; } && [ "$(cat "$stamp" 2>/dev/null)" != "$(date -u +%F)" ]; then
    notify ":warning: SENSO capacity: ${mem}MB RSS, ${creators} creators (heap limit 4096MB, read model measured to ~35k). Plan the SQL read path — CLAUDE.md D42."
    date -u +%F > "$stamp"
  fi
  exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$STATE"
echo "$(date -u +%FT%TZ) health $code (failure $fails)"
if [ "$fails" -eq 2 ]; then
  notify ":rotating_light: SENSO health returned $code twice — restarting under PM2 ($(hostname))"
  pm2 restart senso --update-env >/dev/null 2>&1 || notify ":x: pm2 restart senso failed on $(hostname)"
elif [ "$fails" -gt 2 ] && [ $((fails % 6)) -eq 0 ]; then
  notify ":rotating_light: SENSO still down after restart — $fails checks ($code)"
fi
