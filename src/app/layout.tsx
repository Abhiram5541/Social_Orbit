import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

/**
 * Two voices with non-overlapping jobs.
 *
 * Plus Jakarta Sans sets every heading and — the decision that matters —
 * every numeral. It ships tabular figures, so a metric column aligns without
 * a companion monospace, and its rounded geometry is what makes a score read
 * as friendly rather than clinical.
 *
 * Inter carries interface text, where the job is to disappear: it stays
 * legible at 12px in a dense table and never competes with the display voice.
 */
const display = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SENSO — Influencer Intelligence",
    template: "%s · SENSO",
  },
  description:
    "Evidence-based influencer intelligence: verified creator profiles, deterministic scoring, audience quality signals and campaign performance measurement.",
  applicationName: "SENSO",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Duplicates --color-canvas in globals.css by value — Next metadata cannot
  // read a CSS custom property. Change both together.
  themeColor: "#e6e3ec",
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
