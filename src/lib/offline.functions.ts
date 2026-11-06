import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Compact document shipped to the browser for offline answering. */
export type OfflineDoc = { h: string; t: string; q: string; a: string; k: "entry" | "conversation" | "folder" | "multilang" };

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Only the owner can do this.");
}

export const getOfflinePackStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("offline_packs")
      .select("published, doc_count, updated_at")
      .eq("id", "main")
      .maybeSingle();
    return { published: Boolean(data?.published), docCount: data?.doc_count ?? 0, updatedAt: data?.updated_at ?? null };
  });

export const publishOfflinePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const uid = context.userId;
    const [hRes, eRes, cRes, fRes, mRes] = await Promise.all([
      sb.from("kb_headings").select("id, name").eq("user_id", uid),
      sb.from("kb_entries").select("heading_id, subtopic, title, content, tags").eq("user_id", uid),
      sb.from("kb_conversations").select("heading_id, user_message, ai_message, tags").eq("user_id", uid),
      sb.from("kb_folders").select("name, content").eq("user_id", uid),
      sb.from("kb_ml_items").select("heading_id, original_hindi, translations, statuses").eq("user_id", uid),
    ]);
    const hName = new Map<string, string>((hRes.data ?? []).map((h: any) => [h.id, h.name]));
    const docs: OfflineDoc[] = [];
    for (const e of eRes.data ?? []) {
      const h = hName.get(e.heading_id ?? "") ?? "";
      docs.push({ k: "entry", h, t: e.title || e.subtopic || "", q: [h, e.subtopic, e.title, (e.tags as string[] | null ?? [])].flat().filter(Boolean).join(" "), a: e.content ?? "" });
    }
    for (const c of cRes.data ?? []) {
      docs.push({ k: "conversation", h: hName.get(c.heading_id ?? "") ?? "", t: c.user_message.slice(0, 80), q: [c.user_message, (c.tags as string[] | null ?? [])].flat().filter(Boolean).join(" "), a: c.ai_message });
    }
    for (const f of fRes.data ?? []) {
      docs.push({ k: "folder", h: f.name, t: f.name, q: f.name, a: f.content ?? "" });
    }
    for (const m of mRes.data ?? []) {
      const h = hName.get(m.heading_id ?? "") ?? "";
      const versions = [m.original_hindi as string];
      const translations = (m.translations ?? {}) as Record<string, string | null | undefined>;
      const statuses = (m.statuses ?? {}) as Record<string, string | null | undefined>;
      for (const [code, txt] of Object.entries(translations)) {
        const st = statuses[code];
        if (txt && (st === "completed" || st === "needs_review")) versions.push(txt);
      }
      for (const v of versions) docs.push({ k: "multilang", h, t: v.slice(0, 70), q: h, a: v });
    }
    const clean = docs.filter((d) => d.a.trim());
    const { error } = await sb.from("offline_packs").upsert({
      id: "main",
      docs: clean,
      doc_count: clean.length,
      published: true,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { docCount: clean.length };
  });

export const unpublishOfflinePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("offline_packs")
      .update({ published: false, docs: [], doc_count: 0, updated_at: new Date().toISOString() })
      .eq("id", "main");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
