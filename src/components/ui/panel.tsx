import * as React from "react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * Composition primitives.
 *
 * The product's original failure mode was a tray of identical bordered cards
 * floating on a grey page: every group drawn as its own object, at its own
 * weight, so nothing on a screen could be more important than anything else.
 *
 * These replace that with three composition moves, in increasing weight:
 *
 *   Section   a full-bleed horizontal band on the work canvas, separated from
 *             its neighbours by a rule. Structure without a box. This is the
 *             default — most groupings are a band, not an object.
 *   Split     two or three columns divided by a single shared rule instead of
 *             a gutter between separate cards.
 *   Panel     a genuine object: a chart, a queue, a dossier block. A white,
 *             borderless, rounded card on the canvas — its edge is tonal.
 *
 * Inside any of them, rows and columns separate with `--color-rule`, which is
 * lighter than any edge. Structure inside a container must never compete
 * with the container.
 * ------------------------------------------------------------------------ */

/**
 * A full-bleed band on the work canvas.
 *
 * `bleed` pulls the band out to the page gutters so its rule runs edge to
 * edge, which is what makes a stack of bands read as one continuous surface
 * rather than a column of blocks. Content inside keeps the gutter.
 */
export function Section({
  className,
  tone = "surface",
  bleed = true,
  rule = true,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  /** `sunken` recedes — use for supporting context under a primary band. */
  tone?: "surface" | "sunken" | "canvas";
  bleed?: boolean;
  /** The hairline closing the band. Off for the last band on a page. */
  rule?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "min-w-0",
        tone === "surface" && "bg-surface",
        tone === "sunken" && "bg-sunken",
        tone === "canvas" && "bg-canvas",
        rule && "border-b border-line",
        // Cancels PageBody's gutter, then restores it on the inner content.
        bleed && "-mx-4 px-4 sm:-mx-6 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The heading line of a band or panel: an eyebrow, a title, and whatever the
 * section's own controls are. Deliberately not a bordered CardHeader — inside
 * a band the title sits on the same ground as its content.
 */
export function SectionHead({
  title,
  eyebrow,
  description,
  actions,
  className,
  titleAs = "h2",
}: {
  title: React.ReactNode;
  /** Caps micro-label above the title. Names the *kind* of thing below. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="label-caps-sm mb-1 text-ink-subtle">{eyebrow}</p>
        )}
        {React.createElement(
          titleAs,
          { className: "text-md font-semibold text-ink" },
          title,
        )}
        {description && (
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/**
 * Columns sharing one rule rather than a gutter between separate boxes.
 *
 * `cols` names the intent, not a raw grid template: `lead` gives the first
 * column the weight (the common "primary + context" split), `even` splits
 * equally, `aside` puts a narrow rail on the right.
 */
export function Split({
  cols = "even",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  cols?: "even" | "lead" | "aside" | "thirds";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0",
        // The rule lives on each child's leading edge at wide widths, so the
        // divider is a single hairline and never a doubled 2px seam.
        "[&>*]:min-w-0 [&>*+*]:border-t [&>*+*]:border-rule",
        cols === "even" &&
          "lg:grid-cols-2 lg:[&>*+*]:border-l lg:[&>*+*]:border-t-0",
        cols === "lead" &&
          "lg:grid-cols-[1.6fr_1fr] lg:[&>*+*]:border-l lg:[&>*+*]:border-t-0",
        cols === "aside" &&
          "xl:grid-cols-[1fr_20rem] xl:[&>*+*]:border-l xl:[&>*+*]:border-t-0",
        cols === "thirds" &&
          "lg:grid-cols-3 lg:[&>*+*]:border-l lg:[&>*+*]:border-t-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A genuine object on the canvas — reserved for things that are one artifact:
 * a chart, a queue, a dossier block. White, borderless, with a whisper of
 * shadow so it sits on the ground rather than being printed on it.
 */
export function Panel({
  className,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag
      // `min-w-0`: as a grid child a panel defaults to `min-width: auto`, and
      // dense content then pushes it wider than its track — which is how a
      // table quietly widens the whole page. Wide content scrolls internally.
      className={cn(
        "min-w-0 overflow-hidden rounded-xl bg-surface card-shadow",
        className,
      )}
      {...props}
    />
  );
}

/** The heading band of a Panel. One rule, no tonal fill. */
export function PanelHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule px-5 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }) {
  return (
    <Tag className={cn("text-md font-semibold text-ink", className)} {...props} />
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/**
 * The line under a panel that says where its numbers came from or what to do
 * next. Recessed, so it reads as apparatus rather than content.
 */
export function PanelFoot({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule bg-sunken/60 px-5 py-2.5 text-sm text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A stack of rows inside a Section or Panel, separated by the internal rule.
 * The single most repeated shape in the product — every queue, feed and list.
 */
export function RowList({
  className,
  as: Tag = "ul",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag
      className={cn("divide-y divide-rule", className)}
      {...props}
    />
  );
}

/**
 * The deep-forest feature card.
 *
 * The one place a screen is allowed to speak loudly, and it is spent on the
 * screen's single headline reading — a roster's median health, a campaign's
 * performance score, a creator's dossier readout. It is a rounded card set
 * on the canvas like every other card, in the product's one dark material,
 * so it is read as the feature rather than as chrome.
 *
 * At most one per screen. Two of these and neither is the headline.
 */
export function Instrument({
  className,
  inset = true,
  bleed = false,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  /** Page-level use: the card sits inside the page gutter. */
  inset?: boolean;
  /** Nested inside PageBody: already inside the gutter, so no margin. */
  bleed?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "bg-instrument relative min-w-0 overflow-hidden rounded-2xl text-instrument-ink shadow-instrument",
        // A soft green bloom in one corner, so the card has depth without a
        // gradient fill — the references light their dark cards the same way.
        "before:pointer-events-none before:absolute before:-right-24 before:-top-24 before:size-72 before:rounded-full before:bg-brand-glow/12 before:blur-3xl",
        "px-5 sm:px-7",
        // Page-level: inside the gutter, and a gap before whatever follows.
        inset && !bleed && "mb-4 sm:mx-1",
        className,
      )}
      {...props}
    />
  );
}

/** A caps micro-label on the instrument. Its one legible label style. */
export function InstrumentLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("label-caps-sm text-instrument-muted", className)} {...props} />;
}
