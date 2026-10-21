import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("marks added and removed words", () => {
    const parts = wordDiff("Responsible for building the API", "Built the API in Go");
    const added = parts.filter((p) => p.type === "added").map((p) => p.text).join("");
    const removed = parts.filter((p) => p.type === "removed").map((p) => p.text).join("");
    expect(removed).toContain("Responsible");
    expect(added).toContain("Built");
    expect(added).toContain("Go");
    expect(parts.filter((p) => p.type === "same").map((p) => p.text).join("")).toContain("API");
  });

  it("returns one unchanged part for identical text", () => {
    expect(wordDiff("same text", "same text")).toEqual([{ text: "same text", type: "same" }]);
  });

  it("reconstructs both sides", () => {
    const before = "Led migration of 14 services";
    const after = "Led a zero-downtime migration of 14 services to PostgreSQL";
    const parts = wordDiff(before, after);
    expect(parts.filter((p) => p.type !== "added").map((p) => p.text).join("")).toBe(before);
    expect(parts.filter((p) => p.type !== "removed").map((p) => p.text).join("")).toBe(after);
  });
});

describe("wordDiff punctuation", () => {
  it("marks only the full stop when it is the only change", () => {
    const parts = wordDiff("Kafka consumer.", "Kafka consumer");
    expect(parts).toEqual([
      { text: "Kafka consumer", type: "same" },
      { text: ".", type: "removed" },
    ]);
  });
});
