/**
 * Context Memory — shared by MindLM (server) and the offline engine (browser).
 *
 * Resolves referring questions ("isse aur batao", "iski detail do", "more on this",
 * "इसके बारे में विस्तार से बताओ") by merging the current question with the main
 * topic of the recent conversation, so retrieval works on meaning, not keywords alone.
 * Pure functions only — no server or browser dependencies.
 */

export type HistoryMsg = { role: "user" | "assistant" | string; text: string };

const FILLERS = new Set([
  // Hinglish / English
  "batao", "bataiye", "btao", "bata", "samjhao", "samjhaiye", "do", "dena", "de", "na", "nahi",
  "please", "tell", "explain", "about", "kuch", "thoda", "zyada", "jyada", "vistar", "detail", "detailed",
  "kya", "hai", "hain", "ka", "ke", "ki", "ko", "me", "mein", "se", "par", "to",
  "what", "is", "are", "the", "a", "an", "of", "in", "on", "for", "and", "or", "it",
  // Hindi (Devanagari)
  "बताओ", "बताइए", "समझाओ", "समझाइए", "दो", "ना", "नहीं", "कुछ", "थोड़ा", "ज्यादा", "विस्तार", "बारे", "और", "aur",
  "क्या", "है", "हैं", "का", "के", "की", "को", "में", "से", "पर", "और", "या",
]);

/** Words that point back at the previous topic instead of naming one. */
const REFERRING = new Set([
  "iska", "iske", "iski", "isme", "isse", "ise", "isi", "is",
  "uska", "uske", "uski", "usme", "usse", "use", "us", "usi",
  "इसका", "इसके", "इसकी", "इसमें", "इसे", "इस", "इसी", "इसपर",
  "उसका", "उसके", "उसकी", "उसमें", "उसे", "उस", "उसी", "उसपर",
  "it", "this", "that", "them", "there", "more", "also", "continue", "elaborate", "extra", "again",
  "यह", "ये", "वह", "वो", "इन", "उन", "इनका", "उनका", "इनके", "उनके",
]);

function tok(text: string): string[] {
  return ((text || "").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((t) => t.length > 1);
}

/**
 * Merge a (possibly referring) question with the topic of the recent conversation.
 * Returns the resolved query to retrieve with, and whether history was needed.
 */
export function resolveContextualQuery(
  question: string,
  history: HistoryMsg[] = [],
): { resolved: string; usedHistory: boolean } {
  const tokens = tok(question);
  if (!tokens.length || history.length === 0) return { resolved: question, usedHistory: false };

  const referring = tokens.filter((t) => REFERRING.has(t)).length;
  const meaningful = tokens.filter((t) => !FILLERS.has(t) && !REFERRING.has(t));
  const looksReferring = meaningful.length === 0 || (tokens.length <= 7 && referring >= 1);
  if (!looksReferring) return { resolved: question, usedHistory: false };

  const topic = topicTokens(history, tokens);
  if (!topic.length) return { resolved: question, usedHistory: false };

  const merged = [...new Set([...topic, ...tokens])];
  return { resolved: merged.join(" "), usedHistory: true };
}

/** Frequent content words from the last few turns — the current topic of the conversation. */
function topicTokens(history: HistoryMsg[], exclude: string[]): string[] {
  // Anchor to the latest substantive user question, not frequent words from an older topic.
  let anchor = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message?.role !== "user") continue;
    const content = tok(message.text).filter((t) => !FILLERS.has(t) && !REFERRING.has(t));
    if (content.length) { anchor = i; break; }
  }
  const recent = anchor >= 0 ? history.slice(anchor) : history.slice(-2);
  const freq = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const t of tok(text)) {
      if (FILLERS.has(t) || REFERRING.has(t)) continue;
      if (exclude.includes(t)) continue;
      freq.set(t, (freq.get(t) ?? 0) + weight);
    }
  };
  recent.forEach((m, i) => {
    // the user's own words name the topic; the assistant's answer confirms and extends it
    const base = m.role === "assistant" ? 1 : 4;
    const last = i === recent.length - 1 ? 2 : 1;
    add(m.text, base * last);
  });
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
}
