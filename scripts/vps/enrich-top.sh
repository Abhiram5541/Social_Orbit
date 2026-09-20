#!/usr/bin/env bash
# Runs AI classification over the creators a demo reaches first — the top of
# the health-sorted index — in small batches through the app's own operator
# endpoint. Each creator costs ~2,900 model tokens and three YouTube comment
# reads (3 quota units), which is why this is bounded rather than "everyone".
# Run as root on the VPS; the super admin password is read from
# /root/senso-accounts.txt and never printed.
#
#   bash scripts/vps/enrich-top.sh [count=300] [batch=10]
set -euo pipefail
COUNT=${1:-300}
BATCH=${2:-10}
APP=${APP_URL_LOCAL:-http://127.0.0.1:3005}
ACCOUNTS=/root/senso-accounts.txt

pw=$(grep -E '^admin@senso360.com ' "$ACCOUNTS" | sed -E 's/^[^:]+: //')
[ -n "$pw" ] || { echo "no super admin password in $ACCOUNTS"; exit 1; }
jar=$(mktemp); trap 'rm -f "$jar"' EXIT
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$jar" -H 'content-type: application/json' \
  -d "$(node -e 'console.log(JSON.stringify({email:"admin@senso360.com",password:process.argv[1]}))' "$pw")" \
  "$APP/api/internal/auth/login")
[ "$code" = 200 ] || { echo "sign-in failed ($code)"; exit 1; }

ids=()
page=1
while [ "${#ids[@]}" -lt "$COUNT" ]; do
  batch_ids=$(curl -s -b "$jar" "$APP/api/internal/influencers?sort=health_score_desc&pageSize=100&page=$page" \
    | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const i of (b.page?.items??b.items??[]))if(!i.isDemo)console.log(i.id)')
  [ -n "$batch_ids" ] || break
  while read -r id; do ids+=("$id"); done <<<"$batch_ids"
  page=$((page + 1))
done
ids=("${ids[@]:0:$COUNT}")
echo "candidates: ${#ids[@]} (already-classified ones are skipped by the endpoint)"

done_n=0; tokens=0; failed=0
for ((i = 0; i < ${#ids[@]}; i += BATCH)); do
  chunk=("${ids[@]:i:BATCH}")
  body=$(printf '%s\n' "${chunk[@]}" | node -e 'const ids=require("fs").readFileSync(0,"utf8").trim().split("\n");console.log(JSON.stringify({ids,limit:ids.length}))')
  out=$(curl -s -m 900 -b "$jar" -H 'content-type: application/json' -d "$body" "$APP/api/internal/ai/enrich")
  read -r n t f < <(printf '%s' "$out" | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(r.enriched||0,r.totalTokens||0,(r.results||[]).filter(x=>!x.ok).length)' 2>/dev/null || echo "0 0 $BATCH")
  done_n=$((done_n + n)); tokens=$((tokens + t)); failed=$((failed + f))
  printf '%s batch %d: %s enriched, %s tokens, %s skipped/failed\n' "$(date -u +%H:%M:%S)" $((i / BATCH + 1)) "$n" "$t" "$f"
  case "$out" in *stoppedEarly\":\"*) echo "stopped early: $out" | cut -c1-300; break ;; esac
done
echo "total: $done_n enriched, $tokens tokens, $failed skipped/failed"
