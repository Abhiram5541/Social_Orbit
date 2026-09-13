import { describe, expect, it } from "vitest";
import { encode } from "./postgres";

describe("encode", () => {
  it("repairs what jsonb rejects: a lone surrogate and U+0000", () => {
    // Slices through the emoji, leaving a lone high surrogate — what a bio
    // cut at 400 characters produces.
    const cut = "bio \u{1F64F}".slice(0, 5);
    const rows = [{ id: "a", data: { bio: cut, title: "x\u0000y" } }];
    const parsed = JSON.parse(encode(rows));
    expect(parsed[0].data.bio).toBe("bio \uFFFD");
    expect(parsed[0].data.title).toBe("xy");
  });
});
