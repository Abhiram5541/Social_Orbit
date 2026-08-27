import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

/**
 * One family, the full weight range.
 *
 * Montserrat is a geometric sans whose digits are all exactly the same width
 * with no feature flags needed, so metric columns align without a companion
 * monospace — and its zero is a clean oval with no slash through it. That makes
 * a single family viable for interface text and data alike, which is why the
 * earlier Geist/Geist Mono pairing was dropped.
 *
 * The wide weight range is the point: hierarchy here comes from weight contrast
 * (300 against 800) rather than from stacking more type sizes.
 */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SocialOrbit — Influencer Intelligence",
    template: "%s · SocialOrbit",
  },
  description:
    "Evidence-based influencer intelligence: verified creator profiles, deterministic scoring, audience quality signals and campaign performance measurement.",
  applicationName: "SocialOrbit",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16161a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full`}>
      <body className="min-h-full antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
