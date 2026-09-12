import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge only knows Tailwind's stock font-size names, so the project's
 * custom sizes (text-stat, text-title, …) would be classified as text *colours*
 * — and cn("text-stat", "text-ink") would silently drop one of them. Registering
 * them in the font-size group makes them merge against text-sm and each other.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "2xs",
            "md",
            "stat",
            "stat-lg",
            "title",
            "title-lg",
            "display",
            "display-sm",
            "metric",
            "metric-lg",
            "hero",
          ],
        },
      ],
    },
  },
});

/** Compose class names, letting later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
