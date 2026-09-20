import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "@/lib/contracts/notifications";

const sent: { to: string; ids: string[] }[] = [];
let current: NotificationItem[] = [];

vi.mock("./account-mail", () => ({
  sendAlertDigestMail: async (input: { to: string; alerts: NotificationItem[] }) => {
    sent.push({ to: input.to, ids: input.alerts.map((a) => a.id) });
    return true;
  },
}));
vi.mock("./alert-service", () => ({ alertsFor: () => current }));

const alert = (id: string, severity: NotificationItem["severity"] = "warning"): NotificationItem => ({
  id,
  kind: "dormancy",
  title: id,
  detail: "",
  severity,
});

describe("alert digests", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("emails only what is new since the last digest, and nothing when nothing is", async () => {
    const { sendAlertDigests } = await import("./digest-service");
    const owner = "owner@northwind.example";

    current = [alert("a"), alert("b", "critical"), alert("c", "info")];
    await sendAlertDigests();
    const first = sent.find((s) => s.to === owner);
    expect(first?.ids).toEqual(["a", "b"]); // the info row stays in the inbox only

    sent.length = 0;
    await new Promise((r) => setTimeout(r, 5));
    const again = await sendAlertDigests(new Date(Date.now() + 86_400_000));
    expect(sent.find((s) => s.to === owner)).toBeUndefined();
    expect(again.emailed).toBe(0);

    current = [alert("a"), alert("d")];
    await sendAlertDigests(new Date(Date.now() + 2 * 86_400_000));
    expect(sent.find((s) => s.to === owner)?.ids).toEqual(["d"]);
  });
});
