import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trainModel, answerQuestion, similarity, searchFolders, composeFromSources } from "@/lib/mindlm.server";
import { resolveContextualQuery } from "@/lib/context-memory";

const uuid = z.string().uuid();

/* ------------------------------------------------------------------ */
/* Database — folders                                                  */
/* ------------------------------------------------------------------ */

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_folders")
      .select("id, name, content, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { folders: data ?? [] };
  });

export const saveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: uuid.optional(), name: z.string().trim().min(1), content: z.string().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const q = data.id
      ? context.supabase.from("kb_folders").update({ name: data.name, content: data.content }).eq("id", data.id)
      : context.supabase.from("kb_folders").insert({ user_id: context.userId, name: data.name, content: data.content });
    const { data: row, error } = await q.select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_folders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Database — headings                                                 */
/* ------------------------------------------------------------------ */

export const listHeadings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_headings")
      .select("id, name, description, created_at")
      .order("name", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { headings: data ?? [] };
  });

export const createHeading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1), description: z.string().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kb_headings")
      .insert({ user_id: context.userId, name: data.name.trim(), description: data.description.trim() })
      .select("id, name, description, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHeading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_headings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Knowledge                                                           */
/* ------------------------------------------------------------------ */

export const listEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ headingId: uuid.optional(), search: z.string().max(200).default(""), limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("kb_entries")
      .select("id, heading_id, subtopic, title, content, tags, lang, source, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.headingId) q = q.eq("heading_id", data.headingId);
    if (data.search.trim()) q = q.ilike("content", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });

export const createEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headingId: uuid,
        subtopic: z.string().default(""),
        title: z.string().default(""),
        content: z.string().min(1),
        tags: z.array(z.string()).default([]),
        lang: z.string().max(20).default("auto"),
        source: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kb_entries")
      .insert({
        user_id: context.userId,
        heading_id: data.headingId,
        subtopic: data.subtopic.trim(),
        title: data.title.trim(),
        content: data.content.trim(),
        tags: data.tags,
        lang: data.lang,
        source: data.source.trim(),
      })
      .select("id, heading_id, subtopic, title, content, tags, lang, source, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Conversation examples                                               */
/* ------------------------------------------------------------------ */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_conversations")
      .select("id, heading_id, user_message, ai_message, lang, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { conversations: data ?? [] };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headingId: uuid.nullable().default(null),
        userMessage: z.string().min(1),
        aiMessage: z.string().min(1),
        lang: z.string().max(20).default("auto"),
        tags: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kb_conversations")
      .insert({
        user_id: context.userId,
        heading_id: data.headingId,
        user_message: data.userMessage.trim(),
        ai_message: data.aiMessage.trim(),
        lang: data.lang,
        tags: data.tags,
      })
      .select("id, heading_id, user_message, ai_message, lang, tags, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export const listImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_images")
      .select("id, heading_id, storage_path, label, description, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const images = await Promise.all(
      (data ?? []).map(async (row: any) => {
        const { data: signed } = await context.supabase.storage
          .from("kb-images")
          .createSignedUrl(row.storage_path, 60 * 60);
        return { ...row, url: signed?.signedUrl ?? null };
      }),
    );
    return { images };
  });

export const addImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headingId: uuid.nullable().default(null),
        label: z.string().min(1),
        description: z.string().default(""),
        tags: z.array(z.string()).default([]),
        fileName: z.string().max(200),
        contentType: z.string().max(100),
        dataBase64: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Image is larger than 8MB");
    const ext = (data.fileName.split(".").pop() || "png").toLowerCase().slice(0, 5);
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await context.supabase.storage
      .from("kb-images")
      .upload(path, bytes, { contentType: data.contentType || "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error } = await context.supabase
      .from("kb_images")
      .insert({
        user_id: context.userId,
        heading_id: data.headingId,
        storage_path: path,
        label: data.label.trim(),
        description: data.description.trim(),
        tags: data.tags,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("kb_images")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) await context.supabase.storage.from("kb-images").remove([row.storage_path]);
    const { error } = await context.supabase.from("kb_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* My LLM + Training                                                   */
/* ------------------------------------------------------------------ */

export const listModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [models, runs, counts] = await Promise.all([
      context.supabase
        .from("kb_models")
        .select("id, name, version, status, is_active, params, metrics, vocab_size, doc_count, trained_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("kb_training_runs")
        .select("id, model_id, status, stats, log, started_at, finished_at")
        .order("started_at", { ascending: false })
        .limit(20),
      Promise.all([
        context.supabase.from("kb_headings").select("id", { count: "exact", head: true }),
        context.supabase.from("kb_entries").select("id", { count: "exact", head: true }),
        context.supabase.from("kb_conversations").select("id", { count: "exact", head: true }),
        context.supabase.from("kb_images").select("id", { count: "exact", head: true }),
      ]),
    ]);
    if (models.error) throw new Error(models.error.message);
    return {
      models: models.data ?? [],
      runs: runs.data ?? [],
      dataset: {
        headings: counts[0].count ?? 0,
        entries: counts[1].count ?? 0,
        conversations: counts[2].count ?? 0,
        images: counts[3].count ?? 0,
      },
    };
  });

export const createModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(80), version: z.number().int().min(1).max(999).default(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("kb_models").update({ is_active: false }).eq("user_id", context.userId);
    const { data: row, error } = await context.supabase
      .from("kb_models")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        version: data.version,
        status: "draft",
        is_active: true,
        params: { retriever: "bm25", composer: "extractive", tokenizer: "unicode-word" },
      })
      .select("id, name, version, status, is_active")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const activateModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("kb_models").update({ is_active: false }).eq("user_id", context.userId);
    const { error } = await context.supabase.from("kb_models").update({ is_active: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trainMyModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ modelId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: run, error: runErr } = await context.supabase
      .from("kb_training_runs")
      .insert({ user_id: context.userId, model_id: data.modelId, status: "running" })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);

    try {
      const { stats, log } = await trainModel(context.supabase, context.userId, data.modelId);
      await context.supabase
        .from("kb_training_runs")
        .update({ status: "success", stats, log, finished_at: new Date().toISOString() })
        .eq("id", run.id);
      await context.supabase
        .from("kb_models")
        .update({
          status: "trained",
          vocab_size: stats.vocab_size,
          doc_count: stats.documents,
          metrics: { avg_doc_length: stats.avg_doc_length, duration_ms: stats.duration_ms },
          trained_at: new Date().toISOString(),
        })
        .eq("id", data.modelId);
      return { ok: true, stats };
    } catch (e: any) {
      await context.supabase
        .from("kb_training_runs")
        .update({ status: "failed", log: String(e?.message ?? e), finished_at: new Date().toISOString() })
        .eq("id", run.id);
      throw new Error(String(e?.message ?? e));
    }
  });

/* ------------------------------------------------------------------ */
/* Testing / preview — inference on the owner's own model              */
/* ------------------------------------------------------------------ */

async function activeModel(context: any) {
  const { data } = await context.supabase
    .from("kb_models")
    .select("id, name, version, status, metrics")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export const askMyModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        question: z.string().min(1),
        // recent conversation so referring questions ("isse aur batao") resolve
        history: z
          .array(z.object({ role: z.string(), text: z.string().max(4000) }))
          .max(20)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Context memory: merge the question with the topic of the recent conversation.
    const history = (data.history ?? []).filter((m) => m.role === "user" || m.role === "assistant");
    const { resolved, usedHistory } = resolveContextualQuery(data.question, history);

    // Every database is consulted as needed: saved folders first (always live),
    // then the trained index (knowledge entries, conversations, images, multi-language data).
    const [folderHit, model] = await Promise.all([searchFolders(context.supabase, resolved), activeModel(context)]);
    const trained =
      model && model.status === "trained"
        ? await answerQuestion(context.supabase, context.userId, model.id, resolved, Number(model.metrics?.avg_doc_length ?? 0))
        : null;

    // Both found something different to say — write one composed answer from all of it.
    if (folderHit && trained?.matched) {
      const composed = composeFromSources(resolved, [
        { label: "Folder", text: folderHit.answer, score: folderHit.confidence },
        { label: "Trained model", text: trained.answer, score: trained.confidence },
      ]);
      if (composed.text.trim()) {
        return {
          answer: composed.text,
          matched: true,
          heading: trained.heading ?? folderHit.hits[0]?.folder ?? null,
          confidence: Math.max(folderHit.confidence, trained.confidence),
          sources: [
            ...folderHit.hits.map((h) => ({ kind: "folder", title: h.passage.slice(0, 80), heading: h.folder })),
            ...trained.sources,
          ],
          model: "Multi-source synthesis",
          usedHistory,
        };
      }
    }

    if (folderHit) {
      return {
        answer: folderHit.answer,
        matched: true,
        heading: folderHit.hits[0]?.folder ?? null,
        confidence: folderHit.confidence,
        sources: folderHit.hits.map((h) => ({ kind: "folder", title: h.passage.slice(0, 80), heading: h.folder })),
        model: "Folders",
        usedHistory,
      };
    }

    if (!model) {
      return {
        answer: "No active model yet. Create a model in My LLM and run training.",
        matched: false,
        heading: null,
        confidence: 0,
        sources: [],
        model: null,
        usedHistory,
      };
    }
    if (model.status !== "trained") {
      return {
        answer: "This model is not trained yet. Run training first.",
        matched: false,
        heading: null,
        confidence: 0,
        sources: [],
        model: `${model.name} v${model.version}`,
        usedHistory,
      };
    }
    return { ...trained, model: `${model.name} v${model.version}`, usedHistory };
  });

export const listTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_tests")
      .select("id, question, expected, last_answer, last_score, last_run_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { tests: data ?? [] };
  });

export const createTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ question: z.string().min(1), expected: z.string().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kb_tests")
      .insert({ user_id: context.userId, question: data.question.trim(), expected: data.expected.trim() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const model = await activeModel(context);
    if (!model || model.status !== "trained") throw new Error("Train an active model first.");
    const { data: tests, error } = await context.supabase
      .from("kb_tests")
      .select("id, question, expected")
      .limit(200);
    if (error) throw new Error(error.message);

    const avgLen = Number(model.metrics?.avg_doc_length ?? 0);
    let total = 0;
    for (const t of tests ?? []) {
      const res = await answerQuestion(context.supabase, context.userId, model.id, t.question, avgLen);
      const score = t.expected
        ? (res.matched ? 0.7 * similarity(t.expected, res.answer) + 0.3 * res.confidence : 0)
        : res.confidence;
      total += score;
      await context.supabase
        .from("kb_tests")
        .update({ last_answer: res.answer, last_score: score, last_run_at: new Date().toISOString() })
        .eq("id", t.id);
    }
    const avg = (tests ?? []).length ? total / (tests ?? []).length : 0;
    await context.supabase.from("kb_models").update({ metrics: { ...(model.metrics ?? {}), avg_test_score: avg } }).eq("id", model.id);
    return { count: (tests ?? []).length, avgScore: avg };
  });

/* ------------------------------------------------------------------ */
/* Export — full dataset as JSON for future LLM training               */
/* ------------------------------------------------------------------ */

export const exportDataset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [h, e, c, i] = await Promise.all([
      context.supabase.from("kb_headings").select("*"),
      context.supabase.from("kb_entries").select("*"),
      context.supabase.from("kb_conversations").select("*"),
      context.supabase.from("kb_images").select("*"),
    ]);
    return {
      exported_at: new Date().toISOString(),
      format: "smartgptgo-dataset-v1",
      headings: h.data ?? [],
      knowledge: e.data ?? [],
      conversations: c.data ?? [],
      images: i.data ?? [],
    };
  });
