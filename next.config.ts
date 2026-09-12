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
};

export default nextConfig;
