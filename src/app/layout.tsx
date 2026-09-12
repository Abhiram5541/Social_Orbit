import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

/**
 * Two voices with non-overlapping jobs.
 *
 * Space Grotesk sets every heading and — the decision that matters — every
 * numeral. It descends from Space Mono, so its digits are uniform width by
 * construction: a metric column aligns without a companion monospace and
 * without a feature flag, and its figures carry an engineered character that
 * makes a score read as a reading rather than as a label. It replaces
 * Montserrat, which was doing both jobs and was distinctive at neither.
 *
 * Instrument Sans carries interface text, where the job is to disappear: a
 * humanist grotesque that stays legible at 11px in a dense table and never
 * competes with the display voice above it.
 */
const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  // Duplicates --color-instrument in globals.css by value — Next metadata
  // cannot read a CSS custom property. Change both together. The chrome, not
  // the canvas: the browser furniture continues the housing.
  themeColor: "#17181c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
