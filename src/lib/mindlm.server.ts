/**
 * Smart GPT Go — own AI engine ("MindLM").
 *
 * No external LLM is used anywhere in this file. The model is trained from the
 * owner's own dataset (headings, knowledge entries, conversation examples) into
 * a vocabulary + inverted index (df/idf/postings) stored in the project's own
 * database, and inference is a pure retrieval + composition pass over that index.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "for", "and", "or",
  "what", "which", "who", "whom", "how", "why", "when", "where", "do", "does", "did", "it",
  "this", "that", "with", "by", "at", "as", "be", "me", "my", "you", "your",
  "है", "हैं", "था", "थे", "थी", "का", "के", "की", "को", "में", "से", "पर", "और", "या",
  "क्या", "कौन", "कैसे", "क्यों", "कब", "कहाँ", "कहां", "हूँ", "हूं", "हो", "मैं", "आप",
  "kya", "kaun", "kaise", "kyu", "kyun", "kab", "kaha", "hai", "hain", "ka", "ke", "ki",
  "ko", "me", "se", "par", "aur", "ya", "ho", "hu", "main", "aap",
  // question / filler words (English, Hindi, Hinglish) that carry no topic meaning
  "tell", "explain", "about", "please", "can", "could", "give", "define", "meaning", "mean",
  "batao", "bataiye", "btao", "bata", "samjhao", "samjhaiye", "hota", "hoti", "hote", "matlab",
  "kuch", "mujhe", "hame", "hum", "tum", "yeh", "ye", "woh", "wo", "isme", "iske", "uske", "kar", "karo",
  "बताओ", "बताइए", "बताइये", "समझाओ", "समझाइए", "होता", "होती", "होते", "मतलब", "कुछ", "मुझे",
  "यह", "ये", "वह", "वो", "इसके", "उसके", "करो", "कीजिए", "बारे",
]);

export type Doc = {
  source_kind: "entry" | "conversation" | "image" | "multilang";
  source_id: string | null;
  heading_id: string | null;
  heading_name: string;
  title: string;
  text: string;
  answer: string;
};

export function tokenize(input: string): string[] {
  const raw = (input || "").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return raw.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function splitSentences(text: string): string[] {
  return (text || "")
    .split(/(?<=[.!?।\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

type ChunkFn = (rows: any[]) => Promise<void>;

async function inChunks(rows: any[], size: number, fn: ChunkFn) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

/** Train a model version from the owner's dataset. Returns run statistics. */
export async function trainModel(supabase: any, userId: string, modelId: string) {
  const startedAt = Date.now();
  const log: string[] = [];

  const [headingsRes, entriesRes, convRes, imagesRes, mlRes] = await Promise.all([
    supabase.from("kb_headings").select("id, name, description").eq("user_id", userId),
    supabase.from("kb_entries").select("id, heading_id, subtopic, title, content, tags").eq("user_id", userId),
    supabase.from("kb_conversations").select("id, heading_id, user_message, ai_message, tags").eq("user_id", userId),
    supabase.from("kb_images").select("id, heading_id, label, description, tags").eq("user_id", userId),
    supabase.from("kb_ml_items").select("id, heading_id, original_hindi, translations, statuses").eq("user_id", userId),
  ]);
  for (const r of [headingsRes, entriesRes, convRes, imagesRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const headings: any[] = headingsRes.data ?? [];
  const headingName = new Map<string, string>(headings.map((h) => [h.id, h.name]));

  const docs: Doc[] = [];
  for (const e of entriesRes.data ?? []) {
    docs.push({
      source_kind: "entry",
      source_id: e.id,
      heading_id: e.heading_id,
      heading_name: headingName.get(e.heading_id) ?? "",
      title: e.title || e.subtopic || "",
      text: [headingName.get(e.heading_id) ?? "", e.subtopic, e.title, (e.tags ?? []).join(" "), e.content]
        .filter(Boolean)
        .join(" \n "),
      answer: e.content,
    });
  }
  for (const c of convRes.data ?? []) {
    docs.push({
      source_kind: "conversation",
      source_id: c.id,
      heading_id: c.heading_id,
      heading_name: c.heading_id ? headingName.get(c.heading_id) ?? "" : "",
      title: c.user_message.slice(0, 80),
      text: [c.user_message, (c.tags ?? []).join(" ")].filter(Boolean).join(" \n "),
      answer: c.ai_message,
    });
  }
  for (const im of imagesRes.data ?? []) {
    if (!im.label && !im.description) continue;
    docs.push({
      source_kind: "image",
      source_id: im.id,
      heading_id: im.heading_id,
      heading_name: im.heading_id ? headingName.get(im.heading_id) ?? "" : "",
      title: im.label,
      text: [im.label, im.description, (im.tags ?? []).join(" ")].filter(Boolean).join(" \n "),
      answer: im.description || im.label,
    });
  }

  // Multi-language data: the Hindi original plus every finished language version,
  // each kept as its own document tagged with its language code.
  let mlDocs = 0;
  for (const m of mlRes.error ? [] : mlRes.data ?? []) {
    const versions: Array<[string, string]> = [["hi", m.original_hindi]];
    for (const [code, txt] of Object.entries((m.translations ?? {}) as Record<string, string>)) {
      const st = (m.statuses ?? {})[code];
      if (txt && (st === "completed" || st === "needs_review")) versions.push([code, txt]);
    }
    const hName = m.heading_id ? headingName.get(m.heading_id) ?? "" : "";
    for (const [code, txt] of versions) {
      docs.push({
        source_kind: "multilang",
        source_id: m.id,
        heading_id: m.heading_id,
        heading_name: hName,
        title: `[${code}] ${txt.slice(0, 70)}`,
        text: [hName, txt].filter(Boolean).join(" \n "),
        answer: txt,
      });
      mlDocs++;
    }
  }

  log.push(`dataset: ${headings.length} headings, ${docs.length} documents`);

  // Clear the previous index for this model version.
  await supabase.from("kb_model_terms").delete().eq("model_id", modelId);
  await supabase.from("kb_model_docs").delete().eq("model_id", modelId);

  // Insert docs and keep their generated ids.
  const docRows = docs.map((d) => ({
    user_id: userId,
    model_id: modelId,
    source_kind: d.source_kind,
    source_id: d.source_id,
    heading_id: d.heading_id,
    heading_name: d.heading_name,
    title: d.title,
    text: d.text,
    answer: d.answer,
    length: tokenize(d.text).length,
  }));

  const insertedIds: string[] = [];
  await inChunks(docRows, 200, async (chunk) => {
    const { data, error } = await supabase.from("kb_model_docs").insert(chunk).select("id");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) insertedIds.push(row.id);
  });

  // Build the inverted index.
  const postings = new Map<string, Array<[string, number]>>();
  const headingWeights = new Map<string, Record<string, number>>();
  let totalLength = 0;

  docRows.forEach((row, i) => {
    const docId = insertedIds[i];
    if (!docId) return;
    const tf = termFreq(tokenize(row.text));
    totalLength += row.length;
    for (const [term, count] of tf) {
      const arr = postings.get(term) ?? [];
      arr.push([docId, count]);
      postings.set(term, arr);
      if (row.heading_id) {
        const hw = headingWeights.get(term) ?? {};
        hw[row.heading_id] = (hw[row.heading_id] ?? 0) + count;
        headingWeights.set(term, hw);
      }
    }
  });

  const N = Math.max(1, docRows.length);
  const termRows = [...postings.entries()].map(([term, list]) => ({
    user_id: userId,
    model_id: modelId,
    term,
    df: list.length,
    idf: Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5)),
    postings: list,
    heading_weights: headingWeights.get(term) ?? {},
  }));

  await inChunks(termRows, 500, async (chunk) => {
    const { error } = await supabase.from("kb_model_terms").insert(chunk);
    if (error) throw new Error(error.message);
  });

  const stats = {
    headings: headings.length,
    documents: docRows.length,
    entries: (entriesRes.data ?? []).length,
    conversations: (convRes.data ?? []).length,
    images: (imagesRes.data ?? []).length,
    multilang_docs: mlDocs,
    vocab_size: termRows.length,
    avg_doc_length: docRows.length ? Math.round(totalLength / docRows.length) : 0,
    duration_ms: Date.now() - startedAt,
  };
  log.push(`vocabulary: ${termRows.length} terms`);
  log.push(`finished in ${stats.duration_ms} ms`);

  return { stats, log: log.join("\n") };
}

export type Answer = {
  answer: string;
  matched: boolean;
  heading: string | null;
  confidence: number;
  sources: Array<{ kind: string; title: string; heading: string }>;
};

const BM25_K1 = 1.4;
const NOT_TAUGHT = "This information has not been taught yet. Add it under a heading and train the model again.";

/** Fuzzy-expand query tokens against the trained vocabulary (handles small spelling mistakes). */
async function resolveTerms(supabase: any, modelId: string, qTokens: string[]) {
  const { data: exact, error } = await supabase
    .from("kb_model_terms")
    .select("term, idf, postings, heading_weights")
    .eq("model_id", modelId)
    .in("term", qTokens);
  if (error) throw new Error(error.message);
  const byQ = new Map<string, { row: any; weight: number }>();
  for (const r of exact ?? []) byQ.set(r.term, { row: r, weight: 1 });
  for (const q of qTokens) {
    if (byQ.has(q) || q.length < 3) continue;
    const { data: cands } = await supabase
      .from("kb_model_terms")
      .select("term, idf, postings, heading_weights")
      .eq("model_id", modelId)
      .like("term", `${q.slice(0, 2)}%`)
      .limit(300);
    let best: any = null;
    let bestW = 0;
    for (const c of cands ?? []) {
      const w = termMatch(q, c.term);
      if (w > bestW) { bestW = w; best = c; }
    }
    if (best && bestW >= 0.45) byQ.set(q, { row: best, weight: bestW });
  }
  return byQ;
}

/** Inference: retrieve from the trained index and compose the final answer. */
export async function answerQuestion(
  supabase: any,
  _userId: string,
  modelId: string,
  question: string,
  _avgLen: number,
): Promise<Answer> {
  const qTokens = [...new Set(tokenize(question))];
  if (qTokens.length === 0) {
    return { answer: "Please ask a full question.", matched: false, heading: null, confidence: 0, sources: [] };
  }
  const resolved = await resolveTerms(supabase, modelId, qTokens);
  const notTaught: Answer = { answer: NOT_TAUGHT, matched: false, heading: null, confidence: 0, sources: [] };
  if (resolved.size === 0) return notTaught;

  // Query idf mass — unknown tokens count as highly specific (so missing topics lower coverage).
  const maxIdf = Math.max(...[...resolved.values()].map((v) => v.row.idf), 1);
  const qIdf = new Map<string, number>(qTokens.map((q) => [q, resolved.get(q)?.row.idf ?? maxIdf]));
  const totalIdf = [...qIdf.values()].reduce((a, b) => a + b, 0);

  const scores = new Map<string, number>();
  const docCover = new Map<string, number>();
  const headingScore = new Map<string, number>();
  for (const [q, { row, weight }] of resolved) {
    for (const [docId, tf] of (row.postings ?? []) as Array<[string, number]>) {
      const s = weight * row.idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1));
      scores.set(docId, (scores.get(docId) ?? 0) + s);
      docCover.set(docId, (docCover.get(docId) ?? 0) + weight * (qIdf.get(q) ?? 0));
    }
    for (const [hid, w] of Object.entries((row.heading_weights ?? {}) as Record<string, number>)) {
      headingScore.set(hid, (headingScore.get(hid) ?? 0) + weight * row.idf * Math.log(1 + w));
    }
  }

  // Topic gate: a document must cover at least half of the question's meaning (idf-weighted).
  const eligible = [...scores.entries()]
    .map(([id, sc]) => ({ id, sc, cov: (docCover.get(id) ?? 0) / totalIdf }))
    .filter((d) => d.cov >= 0.5)
    .sort((a, b) => b.sc * b.cov - a.sc * a.cov);
  if (!eligible.length) return notTaught;

  const topIds = eligible.slice(0, 8).map((d) => d.id);
  const { data: docs, error: dErr } = await supabase
    .from("kb_model_docs")
    .select("id, source_kind, heading_id, heading_name, title, answer, text")
    .in("id", topIds);
  if (dErr) throw new Error(dErr.message);
  const rank = new Map(topIds.map((id, i) => [id, i]));
  const ranked = (docs ?? []).sort((a: any, b: any) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const best = ranked[0];
  if (!best) return notTaught;
  const bestCov = eligible[0].cov;

  const bestHeadingId = best.heading_id ??
    [...headingScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const heading = best.heading_name || null;

  if (best.source_kind === "conversation") {
    return {
      answer: best.answer,
      matched: true,
      heading,
      confidence: Math.round(bestCov * 100) / 100,
      sources: [{ kind: "conversation", title: best.title, heading: best.heading_name }],
    };
  }

  // Compose only from documents of the same heading, and only sentences that mention the question topic.
  const matchedTerms = new Set<string>([...resolved.values()].map((v) => v.row.term));
  const pool = ranked.filter((d: any) => d.id === best.id || (bestHeadingId && d.heading_id === bestHeadingId)).slice(0, 4);
  const picked: Array<{ s: string; doc: number; pos: number }> = [];
  const sources: Answer["sources"] = [];
  pool.forEach((d: any, di: number) => {
    const sentences = splitSentences(d.answer || d.text);
    const hitsIn = sentences
      .map((s, pos) => ({ s, pos, hits: tokenize(s).filter((t) => matchedTerms.has(t)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, di === 0 ? 4 : 2);
    let used = false;
    for (const x of hitsIn) {
      if (picked.some((p) => p.s === x.s) || picked.length >= 6) continue;
      picked.push({ s: x.s, doc: di, pos: x.pos });
      used = true;
    }
    if (used) sources.push({ kind: d.source_kind, title: d.title, heading: d.heading_name });
  });
  if (!picked.length) return notTaught;
  // Keep natural order: by document rank, then original sentence order.
  picked.sort((a, b) => a.doc - b.doc || a.pos - b.pos);
  const body = picked.map((p) => p.s).join(" ");

  // Confidence = topic coverage of best doc × how much of the question the composed answer covers.
  const ansToks = new Set(tokenize(body));
  let ansCov = 0;
  for (const q of qTokens) {
    const r = resolved.get(q);
    if (r && ansToks.has(r.row.term)) ansCov += qIdf.get(q) ?? 0;
  }
  const confidence = Math.round(Math.sqrt(bestCov * (ansCov / totalIdf)) * 100) / 100;

  return { answer: (heading ? `${heading}: ${body}` : body).trim(), matched: true, heading, confidence, sources };
}

/** Simple token-overlap score used by the Testing section. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokenize(a).map(stem));
  const B = new Set(tokenize(b).map(stem));
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.max(A.size, B.size);
}

/* ------------------------------------------------------------------ */
/* Folder retrieval — searched live on every question, so new, edited  */
/* and deleted folder data is always in sync with what the AI can use. */
/* ------------------------------------------------------------------ */

function stem(t: string): string {
  return t.length > 4 ? t.replace(/(ing|ed|es|s|ly|ion|tion)$/u, "") : t;
}

function trigrams(t: string): Set<string> {
  const s = ` ${t} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

/** Soft term match: exact/stem match = 1, close spelling/variant = partial credit. */
function termMatch(q: string, d: string): number {
  if (q === d || stem(q) === stem(d)) return 1;
  if (q.length >= 4 && d.length >= 4 && (d.startsWith(q) || q.startsWith(d))) return 0.8;
  const A = trigrams(q);
  const B = trigrams(d);
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  const sim = hit / Math.max(A.size, B.size);
  return sim >= 0.5 ? sim * 0.7 : 0;
}

export type FolderHit = { folder: string; passage: string; score: number };

export async function searchFolders(supabase: any, question: string): Promise<{ answer: string; hits: FolderHit[]; confidence: number } | null> {
  const qTokens = [...new Set(tokenize(question))];
  if (!qTokens.length) return null;
  const { data, error } = await supabase.from("kb_folders").select("id, name, content").limit(1000);
  if (error || !data?.length) return null;

  // Passages = paragraphs/sentences of every folder, each prefixed by folder name for context.
  const passages: Array<{ folder: string; text: string; toks: string[] }> = [];
  for (const f of data) {
    const nameToks = tokenize(f.name);
    const parts = (f.content || "").split(/\n\s*\n/).flatMap((p: string) => {
      const s = splitSentences(p);
      return s.length > 3 ? s : [p.trim()];
    }).filter((p: string) => p.length > 2);
    for (const p of parts.length ? parts : [f.name]) {
      passages.push({ folder: f.name, text: p, toks: [...nameToks, ...tokenize(p)] });
    }
  }
  const N = passages.length;
  const df = new Map<string, number>();
  for (const p of passages) for (const t of new Set(p.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  const scored = passages.map((p) => {
    const uniq = [...new Set(p.toks)];
    let score = 0;
    let covered = 0;
    for (const q of qTokens) {
      let best = 0;
      let bestTok = q;
      for (const d of uniq) {
        const m = termMatch(q, d);
        if (m > best) { best = m; bestTok = d; }
      }
      if (best > 0) { covered++; score += best * idf(bestTok); }
    }
    score *= 0.5 + 0.5 * (covered / qTokens.length);
    return { folder: p.folder, passage: p.text, score, coverage: covered / qTokens.length };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.coverage < 0.5) return null;
  const hits = scored.filter((x) => x.score >= top.score * 0.55).slice(0, 4);
  const byFolder = new Map<string, string[]>();
  for (const h of hits) byFolder.set(h.folder, [...(byFolder.get(h.folder) ?? []), h.passage]);
  const answer = [...byFolder.entries()].map(([f, ps]) => `${f}: ${ps.join(" ")}`).join("\n\n");
  return { answer, hits, confidence: Math.min(1, top.coverage) };
}

/* ------------------------------------------------------------------ */
/* Cross-source synthesis — the AI reads several databases (folders,   */
/* trained knowledge, conversations, multi-language data) as needed,   */
/* then writes one answer in its own words: it merges the relevant     */
/* sentences, drops duplicates and keeps a natural order.              */
/* ------------------------------------------------------------------ */

export type RawSource = { label: string; text: string; score: number };

function toks(s: string): Set<string> {
  return new Set(tokenize(s));
}

function overlap(a: string, b: string): number {
  const A = toks(a);
  const B = toks(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.min(A.size, B.size);
}

/**
 * Compose one flowing answer out of material pulled from multiple sources.
 * Sources are tried best-first; inside each source the sentence order of the
 * original text is preserved; near-duplicate sentences across sources are removed.
 */
export function composeFromSources(question: string, sources: RawSource[]): { text: string; used: string[] } {
  const q = toks(question);
  const picked: Array<{ text: string; label: string }> = [];
  const used: string[] = [];
  for (const src of [...sources].sort((a, b) => b.score - a.score)) {
    let added = 0;
    for (const s of splitSentences(src.text)) {
      if (picked.length >= 7 || added >= 4) break;
      const st = toks(s);
      if (!st.size) continue;
      // the sentence must relate to what was asked
      let rel = 0;
      for (const t of q) if (st.has(t)) rel++;
      if (rel === 0) continue;
      // drop sentences that repeat what another source already said
      if (picked.some((p) => overlap(p.text, s) >= 0.8)) continue;
      picked.push({ text: s, label: src.label });
      added++;
    }
    if (added) used.push(src.label);
  }
  return { text: picked.map((p) => p.text).join(" "), used };
}
