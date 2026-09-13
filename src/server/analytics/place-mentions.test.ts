import { describe, expect, it } from "vitest";
import { placeMentions } from "./place-mentions";

describe("placeMentions", () => {
  it("tags a place named in the channel's own description", () => {
    expect(
      placeMentions({ channelText: "Food vlogger from Hyderabad", contentText: [], countryCode: "IN" }),
    ).toEqual(["Hyderabad"]);
  });

  it("needs two uploads when the channel text is silent", () => {
    const one = placeMentions({
      channelText: "",
      contentText: ["Weekend in Bangalore"],
      countryCode: null,
    });
    const two = placeMentions({
      channelText: "",
      contentText: ["Weekend in Bangalore", "Bengaluru traffic explained"],
      countryCode: null,
    });
    expect(one).toEqual([]);
    expect(two).toEqual(["Bengaluru"]);
  });

  it("reads the local script", () => {
    expect(
      placeMentions({ channelText: "రాజమండ్రి vlogs", contentText: [], countryCode: "IN" }),
    ).toEqual(["Rajahmundry"]);
  });

  it("does not tag a Pakistani channel's Hyderabad as the Indian one", () => {
    expect(
      placeMentions({ channelText: "Hyderabad Sindh", contentText: [], countryCode: "PK" }),
    ).toEqual([]);
  });
});
