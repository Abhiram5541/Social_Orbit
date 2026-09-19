import { readFileSync, writeFileSync } from "node:fs";

/*
 * Instagram token plumbing for Business Discovery (CLAUDE.md D35).
 *
 *   node scripts/meta-token.mjs <token>     Exchange a short-lived token for a
 *       long-lived one and print the META_IG_USER_ID / META_IG_TOKEN lines.
 *       An `IGAA…` token (Instagram Login) needs INSTAGRAM_APP_SECRET in the
 *       env file; an `EAA…` Facebook user token needs META_APP_ID/SECRET and
 *       a Page with a linked Instagram account.
 *
 *   node scripts/meta-token.mjs --refresh   Refresh the long-lived Instagram
 *       Login token already in the env file (valid 60 days; refreshable once
 *       it is a day old) and write it back. Run monthly from cron; the app
 *       needs a restart to pick the new value up.
 */

// The first file that actually holds the Meta keys: locally that is .env.local
// (.env.production.local there carries only the auth secrets), on the VPS the
// production file is the only one.
const envFile = [".env.local", ".env.production.local"].find((f) => {
  try { return /^META_APP_ID=.+/m.test(readFileSync(f, "utf8")); } catch { return false; }
});
if (!envFile) { console.error("No env file with META_APP_ID found."); process.exit(1); }
const text = readFileSync(envFile, "utf8");
const env = Object.fromEntries(
  text.split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const version = env.META_GRAPH_VERSION || "v21.0";

async function graph(host, path, params) {
  const url = new URL(`https://${host}/${path.startsWith("oauth") || path.startsWith("access_token") || path.startsWith("refresh_access_token") ? "" : version + "/"}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const body = await (await fetch(url)).json();
  if (body.error) throw new Error(`${path}: ${body.error.message}`);
  return body;
}

const arg = process.argv[2];
if (!arg) { console.error("usage: node scripts/meta-token.mjs <short-lived-token> | --refresh"); process.exit(1); }

if (arg === "--refresh") {
  const current = env.META_IG_TOKEN;
  if (!current?.startsWith("IG")) { console.error("META_IG_TOKEN is not an Instagram Login token; nothing to refresh."); process.exit(1); }
  const next = await graph("graph.instagram.com", "refresh_access_token", { grant_type: "ig_refresh_token", access_token: current });
  writeFileSync(envFile, text.replace(/^META_IG_TOKEN=.*$/m, `META_IG_TOKEN=${next.access_token}`));
  console.log(`refreshed; expires in ${Math.round(next.expires_in / 86400)} days — restart the app to load it`);
  process.exit(0);
}

if (arg.startsWith("IG")) {
  if (!env.INSTAGRAM_APP_SECRET) { console.error("INSTAGRAM_APP_SECRET missing (Dashboard → Instagram → API setup with Instagram login)."); process.exit(1); }
  const long = await graph("graph.instagram.com", "access_token", { grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_APP_SECRET, access_token: arg });
  const me = await graph("graph.instagram.com", "me", { fields: "user_id,username,account_type", access_token: long.access_token });
  console.log(`# Instagram @${me.username} (${me.account_type}), token valid ${Math.round(long.expires_in / 86400)} days`);
  console.log(`META_IG_USER_ID=${me.user_id ?? me.id}`);
  console.log(`META_IG_TOKEN=${long.access_token}`);
  process.exit(0);
}

const long = await graph("graph.facebook.com", "oauth/access_token", {
  grant_type: "fb_exchange_token", client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: arg,
});
const pages = await graph("graph.facebook.com", "me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: long.access_token });
const linked = pages.data.filter((p) => p.instagram_business_account);
if (linked.length === 0) {
  console.error("No Page with a linked Instagram professional account (or the token lacks instagram_basic). Pages seen:", pages.data.length);
  process.exit(1);
}
for (const page of linked) {
  console.log(`# Page "${page.name}" → Instagram @${page.instagram_business_account.username} (Page token, does not expire)`);
  console.log(`META_IG_USER_ID=${page.instagram_business_account.id}`);
  console.log(`META_IG_TOKEN=${page.access_token}`);
}
