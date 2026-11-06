import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORY = z.enum(["general", "business", "study", "language", "content", "productivity"]);

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, category, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().max(120).default("New chat"),
    category: CATEGORY.default("general"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: data.title, category: data.category })
      .select("id, title, category, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

const PartsSchema = z.array(z.any());

export const saveMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    threadId: z.string().uuid(),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      parts: PartsSchema,
    })),
    titleHint: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Replace messages for this thread (idempotent save of full convo)
    await context.supabase.from("chat_messages").delete().eq("thread_id", data.threadId);
    if (data.messages.length > 0) {
      const rows = data.messages.map((m) => ({
        thread_id: data.threadId,
        user_id: context.userId,
        role: m.role,
        parts: m.parts,
      }));
      const { error } = await context.supabase.from("chat_messages").insert(rows);
      if (error) throw new Error(error.message);
    }
    const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (data.titleHint) patch.title = data.titleHint.slice(0, 80);
    await context.supabase.from("chat_threads").update(patch).eq("id", data.threadId);
    return { ok: true };
  });
