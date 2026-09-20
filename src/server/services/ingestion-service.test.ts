import { describe, expect, it } from "vitest";
import { cleanDisplayName } from "./ingestion-service";

describe("cleanDisplayName", () => {
  it("strips what a platform never meant and keeps what a creator wrote", () => {
    expect(cleanDisplayName("Glow & Glam ")).toBe("Glow & Glam");
    expect(cleanDisplayName("  Ram  The\tTraveller ")).toBe("Ram The Traveller");
    expect(cleanDisplayName("​Afsaleeyy﻿")).toBe("Afsaleeyy");
    // A full stop at the end is the channel's own title, not truncation.
    expect(cleanDisplayName("Fun Da.")).toBe("Fun Da.");
  });
});
