#!/usr/bin/env bash
# Onboards a client organisation through the app's own API, as the super
# admin: the organisation with its logo and plan, the owner account with a
# generated password (mail is not wired for clients yet), and a starter
# shortlist of the strongest creators in the categories they care about, so
# their first sign-in lands on a dashboard with something on it. Run as root
# on the VPS; the admin password is read from /root/senso-accounts.txt.
#
#   bash scripts/vps/onboard-client.sh "Kolors Health Care" owner@kolorshealthcare.com "Kolors Owner" \
#        /brand/clients/kolors-health-care.png growth "health,beauty,fitness" IN
set -euo pipefail
ORG_NAME=$1; EMAIL=$2; PERSON=$3; LOGO=${4:-}; PLAN=${5:-growth}; CATEGORIES=${6:-}; COUNTRY=${7:-}
APP=${APP_URL_LOCAL:-http://127.0.0.1:3005}
ACCOUNTS=/root/senso-accounts.txt

json() { node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1])))' "$1"; }
pw=$(grep -E '^admin@senso360.com ' "$ACCOUNTS" | sed -E 's/^[^:]+: //')
jar=$(mktemp); trap 'rm -f "$jar"' EXIT
code=$(curl -s -o /dev/null -w '%{http_code}' -c "$jar" -H 'content-type: application/json' \
  -d "$(node -e 'console.log(JSON.stringify({email:"admin@senso360.com",password:process.argv[1]}))' "$pw")" "$APP/api/internal/auth/login")
[ "$code" = 200 ] || { echo "admin sign-in failed ($code)"; exit 1; }

owner_pw=$(openssl rand -base64 27 | tr -d '/+=' | cut -c1-20)
body=$(node -e '
  const [org, email, person, logo, plan, pw] = process.argv.slice(1);
  console.log(JSON.stringify({ name: person, email, role: "client_owner", password: pw,
    org: { name: org, kind: "client", plan, ...(logo ? { logoUrl: logo } : {}) } }));' \
  "$ORG_NAME" "$EMAIL" "$PERSON" "$LOGO" "$PLAN" "$owner_pw")
created=$(curl -s -b "$jar" -H 'content-type: application/json' -d "$body" "$APP/api/internal/admin/users")
org_id=$(printf '%s' "$created" | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));if(!r.orgId){console.error(JSON.stringify(r));process.exit(1)}console.log(r.orgId)')
echo "org $org_id created; owner $EMAIL"

if [ -n "$CATEGORIES" ]; then
  # Sign in as the owner: shortlists belong to the organisation, not to SENSO staff.
  ojar=$(mktemp); trap 'rm -f "$jar" "$ojar"' EXIT
  curl -s -o /dev/null -c "$ojar" -H 'content-type: application/json' \
    -d "$(node -e 'console.log(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$EMAIL" "$owner_pw")" "$APP/api/internal/auth/login"
  q="sort=health_score_desc&pageSize=12&category=$CATEGORIES"; [ -n "$COUNTRY" ] && q="$q&country=$COUNTRY"
  ids=$(curl -s -b "$ojar" "$APP/api/internal/influencers?$q" | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const i of (b.page?.items??[]))if(!i.isDemo)console.log(i.id)' | head -10)
  label=$(printf '%s' "$CATEGORIES" | tr ',' '/')
  sl=$(curl -s -b "$ojar" -H 'content-type: application/json' \
    -d "$(node -e 'console.log(JSON.stringify({name:process.argv[1],description:process.argv[2]}))' "Starter: $label creators${COUNTRY:+ ($COUNTRY)}" "The strongest creators in these categories by SENSO Health when your workspace was set up. Replace it with your own.")" \
    "$APP/api/internal/shortlists" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).id)')
  n=0
  for id in $ids; do
    curl -s -o /dev/null -b "$ojar" -H 'content-type: application/json' -d "{\"influencerId\":\"$id\"}" "$APP/api/internal/shortlists/$sl/items" && n=$((n+1))
  done
  echo "starter shortlist $sl with $n creators"
fi

umask 077
printf '%s (client_owner, %s): %s\n' "$EMAIL" "$ORG_NAME" "$owner_pw" >> "$ACCOUNTS"
echo "owner password appended to $ACCOUNTS"
