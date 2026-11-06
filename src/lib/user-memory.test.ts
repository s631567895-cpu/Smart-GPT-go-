import { describe, expect, it } from "vitest";
import { pickRelevantMemories } from "./user-memory";

describe("long-term memory relevance", () => {
  it("recalls a saved name when explicitly asked in Hinglish", () => {
    expect(pickRelevantMemories("Mera naam kya hai?", [{ kind: "name", content: "Suresh" }])).toEqual([{ kind: "name", content: "Suresh" }]);
  });
  it("does not include unrelated facts just because a filler word matches", () => {
    expect(pickRelevantMemories("Black Hole kya hai?", [{ kind: "project", content: "Mera YouTube project hai" }])).toEqual([]);
  });
  it("selects relevant project facts", () => {
    expect(pickRelevantMemories("YouTube ke liye ideas", [{ kind: "project", content: "YouTube science channel" }, { kind: "note", content: "I like gardening" }])).toEqual([{ kind: "project", content: "YouTube science channel" }]);
  });
});