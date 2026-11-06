import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listLanguages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_languages")
      .select("code, name, native_name, is_source, sort")
      .eq("enabled", true)
      .order("sort");
    if (error) throw new Error(error.message);
    return { languages: data ?? [] };
  });

export const listMlItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_ml_items")
      .select("id, heading_id, original_hindi, translations, statuses, version, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

/** Create one or many Hindi items (batch mode). Hindi is stored as the untouched original. */
export const createMlItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ texts: z.array(z.string().trim().min(1)).min(1).max(100), heading_id: uuid.nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: langs } = await context.supabase.from("kb_languages").select("code, is_source").eq("enabled", true);
    const statuses = Object.fromEntries((langs ?? []).filter((l) => !l.is_source).map((l) => [l.code, "pending"]));
    const rows = data.texts.map((t) => ({
      user_id: context.userId,
      heading_id: data.heading_id ?? null,
      original_hindi: t,
      statuses,
    }));
    const { data: out, error } = await context.supabase.from("kb_ml_items").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return { ids: (out ?? []).map((r) => r.id) };
  });

export const translateMlItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: item, error }, { data: lang }] = await Promise.all([
      context.supabase.from("kb_ml_items").select("original_hindi").eq("id", data.id).maybeSingle(),
      context.supabase.from("kb_languages").select("code, name, instructions, is_source").eq("code", data.code).maybeSingle(),
    ]);
    if (error || !item) throw new Error("Item not found.");
    if (!lang || lang.is_source) throw new Error("Unknown language.");
    await context.supabase.rpc("kb_ml_set", { _id: data.id, _code: data.code, _status: "generating" });
    const { translateHindi, qualityCheck } = await import("./multilang.server");
    try {
      const text = await translateHindi(item.original_hindi, lang);
      const status = qualityCheck(item.original_hindi, text);
      await context.supabase.rpc("kb_ml_set", { _id: data.id, _code: data.code, _status: status, _text: text });
      return { status, text };
    } catch (e) {
      await context.supabase.rpc("kb_ml_set", { _id: data.id, _code: data.code, _status: "failed" });
      return { status: "failed" as const, error: e instanceof Error ? e.message : "Translation failed." };
    }
  });

/** Manual edit of a generated language. The Hindi original is never touched here. */
export const saveMlTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, code: z.string().min(1), text: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.code === "hi") throw new Error("The Hindi original cannot be changed here.");
    const { error } = await context.supabase.rpc("kb_ml_set", {
      _id: data.id, _code: data.code, _status: data.text.trim() ? "completed" : "pending", _text: data.text,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMlItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_ml_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Original (user-written) headings with how many translated copies exist per language. */
export const listSourceHeadings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kb_headings")
      .select("id, name, description, source_heading_id, lang, translation_status")
      .order("name")
      .limit(2000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const sources = rows.filter((h) => !h.source_heading_id);
    const { data: counts } = await context.supabase.from("kb_entries").select("heading_id");
    const n: Record<string, number> = {};
    for (const c of counts ?? []) n[c.heading_id] = (n[c.heading_id] ?? 0) + 1;
    return {
      headings: sources.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        entries: n[s.id] ?? 0,
        translations: Object.fromEntries(
          rows.filter((r) => r.source_heading_id === s.id && r.lang).map((r) => [r.lang!, { id: r.id, name: r.name, status: r.translation_status }]),
        ),
      })),
    };
  });

/**
 * Translate one original heading (name + description) and all its knowledge entries
 * (subtopic, title, tags, content) into one language, stored as a separate heading.
 * The original heading and entries are never modified. Re-running refreshes the copy.
 */
export const translateHeadingTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ headingId: uuid, code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: src }, { data: lang }, { data: entries }] = await Promise.all([
      sb.from("kb_headings").select("id, name, description, source_heading_id").eq("id", data.headingId).maybeSingle(),
      sb.from("kb_languages").select("code, name, instructions, is_source").eq("code", data.code).maybeSingle(),
      sb.from("kb_entries").select("subtopic, title, content, tags, source").eq("heading_id", data.headingId).order("created_at").limit(1000),
    ]);
    if (!src || src.source_heading_id) throw new Error("Original heading not found.");
    if (!lang || lang.is_source) throw new Error("Unknown language.");

    // find or create the translated heading
    const { data: existing } = await sb.from("kb_headings").select("id").eq("source_heading_id", src.id).eq("lang", lang.code).maybeSingle();
    let targetId = existing?.id;
    if (!targetId) {
      const { data: row, error } = await sb.from("kb_headings")
        .insert({ user_id: context.userId, name: `${src.name} [${lang.code}]`, description: "", source_heading_id: src.id, lang: lang.code, translation_status: "generating" })
        .select("id").single();
      if (error) throw new Error(error.message);
      targetId = row.id;
    } else {
      await sb.from("kb_headings").update({ translation_status: "generating" }).eq("id", targetId);
    }

    const { translateFields } = await import("./multilang.server");
    try {
      const h = await translateFields({ name: src.name, description: src.description ?? "" }, lang);
      const out: Array<{ subtopic: string; title: string; content: string; tags: string[]; source: string }> = [];
      for (let i = 0; i < (entries ?? []).length; i += 3) {
        const chunk = await Promise.all((entries ?? []).slice(i, i + 3).map(async (e) => {
          const t = await translateFields({ subtopic: e.subtopic, title: e.title, content: e.content, tags: e.tags ?? [] }, lang);
          return { ...t, tags: Array.isArray(t.tags) ? t.tags.map(String) : [], source: e.source };
        }));
        out.push(...chunk);
      }
      await sb.from("kb_entries").delete().eq("heading_id", targetId);
      if (out.length) {
        const { error } = await sb.from("kb_entries").insert(out.map((e) => ({
          user_id: context.userId, heading_id: targetId!, subtopic: e.subtopic, title: e.title,
          content: e.content || "-", tags: e.tags, lang: lang.code, source: e.source || "multilang",
        })));
        if (error) throw new Error(error.message);
      }
      await sb.from("kb_headings").update({ name: `${String(h.name).trim() || src.name} [${lang.code}]`, description: String(h.description ?? ""), translation_status: "completed" }).eq("id", targetId);
      return { status: "completed" as const, entries: out.length };
    } catch (e) {
      await sb.from("kb_headings").update({ translation_status: "failed" }).eq("id", targetId);
      return { status: "failed" as const, error: e instanceof Error ? e.message : "Translation failed." };
    }
  });
