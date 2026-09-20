"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Save as PDF" is the browser's print dialog. The print stylesheet in
 * globals.css drops the chrome and lays the page out for paper, so the PDF
 * is the screen the person was looking at — provenance labels included —
 * with no rendering service, headless browser or queue to run.
 */
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <Button variant="ghost" onClick={() => window.print()} className="gap-1.5 print:hidden">
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
