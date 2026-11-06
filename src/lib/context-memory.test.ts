import { describe, expect, it } from "vitest";
import { resolveContextualQuery } from "./context-memory";

describe("conversation context", () => {
  it("resolves a Hindi follow-up using the prior question and answer", () => {
    const result = resolveContextualQuery("इसके बारे में विस्तार से बताओ", [
      { role: "user", text: "Black Hole क्या है?" },
      { role: "assistant", text: "Black Hole में गुरुत्वाकर्षण बहुत अधिक होता है।" },
    ]);
    expect(result.usedHistory).toBe(true);
    expect(result.resolved).toContain("black");
    expect(result.resolved).toContain("hole");
  });

  it("does not pull the old topic into a new explicit question", () => {
    const question = "Explain Earth's atmosphere";
    const result = resolveContextualQuery(question, [
      { role: "user", text: "What is a Black Hole?" },
      { role: "assistant", text: "Black holes have powerful gravity." },
    ]);
    expect(result).toEqual({ resolved: question, usedHistory: false });
  });

  it("does not pretend to know context without history", () => {
    expect(resolveContextualQuery("isse aur batao")).toEqual({
      resolved: "isse aur batao", usedHistory: false,
    });
  });

  it("uses the new topic rather than a repeated older topic", () => {
    const result = resolveContextualQuery("isse aur batao", [
      { role: "user", text: "Black Hole Black Hole Black Hole" },
      { role: "assistant", text: "Black Hole gravity Black Hole gravity" },
      { role: "user", text: "Earth atmosphere" },
      { role: "assistant", text: "Earth atmosphere contains nitrogen and oxygen." },
    ]);
    expect(result.usedHistory).toBe(true);
    expect(result.resolved).toContain("earth");
    expect(result.resolved).not.toContain("black");
  });
});