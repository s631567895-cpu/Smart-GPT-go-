import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, avatar_url, streak_count, last_active_date, created_at, country, language, onboarded")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      display_name: z.string().min(1).max(60).optional(),
      avatar_url: z.string().url().max(1000).optional().nullable(),
      country: z.string().min(1).max(60).optional(),
      language: z.string().min(1).max(40).optional(),
      onboarded: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      updated_at: string;
      display_name?: string;
      avatar_url?: string | null;
      country?: string;
      language?: string;
      onboarded?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.country !== undefined) patch.country = data.country;
    if (data.language !== undefined) patch.language = data.language;
    if (data.onboarded !== undefined) patch.onboarded = data.onboarded;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const touchStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: p } = await context.supabase
      .from("profiles")
      .select("streak_count, last_active_date")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p) return { streak: 1 };
    if (p.last_active_date === today) return { streak: p.streak_count };
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const next = p.last_active_date === yest ? (p.streak_count ?? 0) + 1 : 1;
    await context.supabase
      .from("profiles")
      .update({ streak_count: next, last_active_date: today, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { streak: next };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [threads, images, saved, profile, badges] = await Promise.all([
      context.supabase.from("chat_threads").select("id", { count: "exact", head: true }),
      context.supabase.from("image_history").select("id", { count: "exact", head: true }),
      context.supabase.from("saved_items").select("id", { count: "exact", head: true }),
      context.supabase.from("profiles").select("streak_count").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_badges").select("badge_code"),
    ]);
    return {
      chats: threads.count ?? 0,
      images: images.count ?? 0,
      saved: saved.count ?? 0,
      streak: profile.data?.streak_count ?? 0,
      badges: badges.data?.map((b) => b.badge_code) ?? [],
    };
  });

// Image history
export const listImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("image_history")
      .select("id, prompt, aspect, images, liked, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const toggleLikeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), liked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("image_history").update({ liked: data.liked }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("image_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Saved items / Vault
const KIND = z.enum(["chat", "script", "image", "lesson", "note"]);

export const listSaved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: KIND.optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("saved_items")
      .select("id, kind, title, category, content, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: KIND,
      title: z.string().min(1).max(160),
      category: z.string().max(60).optional(),
      content: z.any(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_items").insert({
      user_id: context.userId,
      kind: data.kind,
      title: data.title,
      category: data.category ?? null,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
