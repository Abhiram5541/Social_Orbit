"use client";

import * as React from "react";
import { ButtonGroup, SegmentButton } from "@/components/ui/button";
import { Columns, type ColumnItem } from "./bento";

/**
 * A column chart with a pill toggle choosing which stored figure it plots —
 * the reference's Monthly / Annually switch. Every option is a full item set,
 * so switching never recomputes anything in the browser.
 */
export function ColumnsToggle({
  options,
  height,
}: {
  options: { label: string; items: ColumnItem[] }[];
  height?: number;
}) {
  const [index, setIndex] = React.useState(0);
  const current = options[index] ?? options[0];
  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex justify-end">
        <ButtonGroup aria-label="Figure to plot">
          {options.map((option, i) => (
            <SegmentButton
              key={option.label}
              active={i === index}
              onClick={() => setIndex(i)}
            >
              {option.label}
            </SegmentButton>
          ))}
        </ButtonGroup>
      </div>
      <Columns items={current.items} height={height} />
    </div>
  );
}
