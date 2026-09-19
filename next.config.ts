import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The ingested database is read through a path built at runtime, so Next's
   * tracer cannot see it and a deployment would ship every route with an empty
   * database. Naming it here is what puts it in the bundle.
   *
   * The packed copy, not the plain one: 6.7MB against 41MB, copied once per
   * serverless function. `npm run data:pack` produces it.
   */
  outputFileTracingIncludes: {
    "/**/*": [".data/ingested.json.gz"],
  },
  // Dev server rejects cross-origin asset requests by default. Needed to
  // serve the app through a tunnel (Cloudflare, ngrok, etc.) where the
  // browser's origin is the tunnel host, not localhost.
  allowedDevOrigins: ["*.trycloudflare.com"],

  experimental: {
    // A page visited in the last minute is served again from the client's
    // router cache rather than re-rendered: moving between the overview, the
    // database and a profile and back is then instant. The store behind these
    // pages changes on a daily cadence, so a minute is never stale in any way
    // a person could notice.
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
