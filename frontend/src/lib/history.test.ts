import { describe, expect, it } from "vitest";
import { record, redo, undo, type History } from "./history";

const start: History<string> = { past: [], present: "a", future: [] };

describe("history", () => {
  it("undoes and redoes in order", () => {
    let h = record(record(start, "b"), "c");
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(undo(h)).toBe(h); // nothing left to undo
    h = redo(h);
    expect(h.present).toBe("b");
  });

  it("drops the redo branch when a new change is made", () => {
    let h = undo(record(start, "b"));
    h = record(h, "x");
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it("coalesces typing into one step", () => {
    let h = record(start, "ab");
    h = record(h, "abc", true);
    h = record(h, "abcd", true);
    expect(h.present).toBe("abcd");
    expect(undo(h).present).toBe("a");
  });
});
