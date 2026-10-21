import { describe, expect, it } from "vitest";
import { lintBullet, lintDocument } from "./lint";

const ids = (t: string) => lintBullet(t).map((n) => n.id);

describe("lintBullet", () => {
  it("passes a strong bullet", () => {
    expect(ids("Cut checkout API p95 latency from 620 ms to 380 ms by moving fraud scoring to a Kafka consumer.")).toEqual([]);
  });

  it("flags duty openers, first person and passive voice", () => {
    expect(ids("Responsible for the billing service")).toEqual(expect.arrayContaining(["opener", "number"]));
    expect(ids("I built 3 dashboards for my team")).toContain("pronoun");
    expect(ids("The pipeline was rebuilt to cut costs by 20%")).toContain("passive");
  });

  it("treats a placeholder as a number and flags long bullets", () => {
    expect(ids("Reduced onboarding time by [X]% for new merchants")).not.toContain("number");
    expect(ids(Array(32).fill("word").join(" ") + " 5")).toContain("length");
  });

  it("does not mistake words that contain pronouns", () => {
    expect(ids("Mentored 3 engineers in Mumbai")).not.toContain("pronoun");
    expect(ids("My team shipped 4 releases")).toContain("pronoun");
    expect(ids("Expanded sales to 3 US states")).not.toContain("pronoun");
  });
});

describe("lintDocument", () => {
  it("flags an opening verb used three or more times", () => {
    const notes = lintDocument([
      { id: "a", text: "Led 3 launches" },
      { id: "b", text: "Led the 2 migrations" },
      { id: "c", text: "Led hiring for 4 roles" },
      { id: "d", text: "Built 2 tools" },
    ]);
    expect(notes.a.map((n) => n.id)).toContain("repeat");
    expect(notes.d.map((n) => n.id)).not.toContain("repeat");
  });
});
