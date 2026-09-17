import { readFileSync } from "node:fs";

/*
 * Turns a short-lived Meta user token (from Tools → Graph API Explorer, with
 * instagram_basic, pages_show_list, pages_read_engagement, business_management)
 * into what Business Discovery needs: the Instagram professional account id and
 * a long-lived Page token that reaches it. A Page token obtained from a
 * long-lived user token does not expire.
 *
 * Usage: node scripts/meta-token.mjs <short-lived-user-token>
 * Prints the two lines to put in .env.local / .env.production.local.
 */

const envFile = [".env.local", ".env.production.local"].find((f) => { try { readFileSync(f); return true; } catch { return false; } });
const env = Object.fromEntries(
  readFileSync(envFile, "utf8").split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const version = env.META_GRAPH_VERSION || "v21.0";
const short = process.argv[2];
if (!short) { console.error("usage: node scripts/meta-token.mjs <short-lived-user-token>"); process.exit(1); }

async function graph(path, params) {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const body = await (await fetch(url)).json();
  if (body.error) throw new Error(`${path}: ${body.error.message}`);
  return body;
}

const long = await graph("oauth/access_token", {
  grant_type: "fb_exchange_token", client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: short,
});
const pages = await graph("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", access_token: long.access_token });
const linked = pages.data.filter((p) => p.instagram_business_account);
if (linked.length === 0) {
  console.error("No Page with a linked Instagram professional account. Pages seen:", pages.data.map((p) => p.name).join(", ") || "none");
  process.exit(1);
}
for (const page of linked) {
  console.log(`# Page "${page.name}" → Instagram @${page.instagram_business_account.username}`);
  console.log(`META_IG_USER_ID=${page.instagram_business_account.id}`);
  console.log(`META_IG_TOKEN=${page.access_token}`);
}
