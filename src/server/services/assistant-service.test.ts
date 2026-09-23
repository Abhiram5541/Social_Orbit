import { describe, expect, it } from "vitest";
import { isGrounded } from "./assistant-service";

/* The grounding check is the safeguard that makes the assistant safe to show:
 * the model narrates, and anything it states as a figure has to be findable
 * in the rows it was handed. */
const allowed = new Set(["12", "84", "1.2M", "1200000", "3.4", "72"]);

describe("assistant grounding", () => {
  it("accepts a narration that only quotes figures from the rows", () => {
    expect(isGrounded("Maya leads with 1.2M followers and a health score of 84.", allowed)).toBe(true);
    expect(isGrounded("Three of the twelve are Indian; engagement sits at 3.4%.", allowed)).toBe(true);
  });

  it("rejects a figure that was never in the rows", () => {
    expect(isGrounded("Maya has 2.5M followers.", allowed)).toBe(false);
    expect(isGrounded("Average engagement is 7.9%.", allowed)).toBe(false);
  });

  it("ignores small counting numbers, which describe the answer not the data", () => {
    expect(isGrounded("Here are the top 5 of 12 matches.", allowed)).toBe(true);
  });
});
