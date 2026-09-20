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

  /*
   * Security headers (CLAUDE.md §10). nginx in front already sets
   * X-Frame-Options, nosniff and a referrer policy; these are the ones it
   * does not, and they travel with the app rather than with the host.
   *
   * The CSP allows inline scripts because Next's hydration payload is one;
   * a nonce would need every route to run through middleware for a gain
   * that, with no third-party script on the page, is theoretical. Images
   * are wide open over https because creator avatars come from whatever
   * CDN each platform uses (Google, Meta) and no list would stay current.
   * No `upgrade-insecure-requests`: HSTS covers production and the directive
   * rewrote every redirect to https on a plain-http dev server or tunnel.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Frame denial is the CSP's `frame-ancestors`; a second X-Frame-Options
          // beside nginx's would only be a duplicate header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },

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
