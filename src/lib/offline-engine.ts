/**
 * Browser-side MindLM for offline use. Pure retrieval over the published pack:
 * BM25 ranking + sentence extraction. No network, no external model.
 */
import type { OfflineDoc } from "./offline.functions";

const STOP = new Set(
  ("the a an is are was were of to in on for and or what which who how why when where do does did it this that with by at as be me my you your " +
    "tell explain about please can could give define meaning mean " +
    "है हैं था थे थी का के की को में से पर और या क्या कौन कैसे क्यों कब कहाँ कहां हूँ हूं हो मैं आप बताओ बताइए समझाओ होता होती होते मतलब कुछ मुझे यह ये वह वो बारे " +
    "kya kaun kaise kyu kyun kab kaha hai hain ka ke ki ko se par aur ya ho hu main aap batao bataiye btao bata samjhao hota hoti hote matlab kuch mujhe yeh ye woh wo kar karo")
    .split(/\s+/),
);

export function tokenize(s: string): string[] {
  return ((s || "").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

const stem = (t: string) => (t.length > 4 ? t.replace(/(ing|ed|es|s|on|ों|ें|ाएं|ियों)$/u, "") : t);

function close(q: string, d: string): number {
  if (q === d) return 1;
  const a = stem(q), b = stem(d);
  if (a === b) return 0.9;
  if (a.length >= 4 && b.length >= 4 && (b.startsWith(a) || a.startsWith(b))) return 0.75;
  if (a.length < 4) return 0;
  // one-edit tolerance for small spelling mistakes
  if (Math.abs(a.length - b.length) > 1) return 0;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return 0;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1 ? 0.7 : 0;
}

type Indexed = { doc: OfflineDoc; tokens: string[]; tf: Map<string, number> };

export function buildIndex(docs: OfflineDoc[]) {
  const items: Indexed[] = docs.map((doc) => {
    const tokens = tokenize(`${doc.q} ${doc.q} ${doc.a}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { doc, tokens, tf };
  });
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = items.reduce((s, i) => s + i.tokens.length, 0) / Math.max(1, items.length);
  return { items, df, avg, vocab: [...df.keys()] };
}

export type OfflineIndex = ReturnType<typeof buildIndex>;

export function answer(index: OfflineIndex, question: string, notFound: string) {
  const qTokens = tokenize(question);
  if (!qTokens.length || !index.items.length) return { text: notFound, confidence: 0, heading: null as string | null };

  // expand each query word to close vocabulary words (typo tolerant)
  const expanded = qTokens.map((q) => {
    const m: Array<[string, number]> = [];
    for (const v of index.vocab) { const w = close(q, v); if (w) m.push([v, w]); }
    return m;
  });

  const N = index.items.length;
  let best: { it: Indexed; score: number; cov: number } | null = null;
  for (const it of index.items) {
    let score = 0, hit = 0;
    for (const terms of expanded) {
      let got = 0;
      for (const [t, w] of terms) {
        const f = it.tf.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - (index.df.get(t) ?? 0) + 0.5) / ((index.df.get(t) ?? 0) + 0.5));
        score += w * idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (it.tokens.length / index.avg))));
        got = Math.max(got, w);
      }
      hit += got;
    }
    const cov = hit / qTokens.length;
    if (cov >= 0.5 && (!best || score * cov > best.score * best.cov)) best = { it, score, cov };
  }
  if (!best) return { text: notFound, confidence: 0, heading: null };

  const d = best.it.doc;
  if (d.k === "conversation" || d.k === "multilang") {
    return { text: d.a, confidence: Math.round(best.cov * 100), heading: d.h || null };
  }
  // extract only sentences that relate to the question, kept in original order
  const sentences = d.a.split(/(?<=[.!?।\n])\s+/).map((s) => s.trim()).filter(Boolean);
  const picked = sentences.filter((s) => {
    const st = tokenize(s);
    return expanded.some((terms) => terms.some(([t]) => st.includes(t)));
  });
  const text = (picked.length ? picked : sentences.slice(0, 3)).slice(0, 6).join(" ");
  return { text, confidence: Math.round(best.cov * 100), heading: d.h || null };
}
