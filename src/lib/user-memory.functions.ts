import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export { pickRelevantMemories } from "./user-memory";

/**
 * User Memory — long-term, important facts about the user (name, preferred language,
 * preferences, projects, useful non-sensitive notes). Completely separate from
 * Context Memory (the running conversation). Used by Smart Chat only when relevant.
 */

const KIND = z.enum(["name", "language", "preference", "project", "note"]);

export const listUserMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_memory")
      .select("id, kind, content, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { memories: data ?? [] };
  });

export const saveUserMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: KIND.default("note"), content: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_memory")
      .insert({ user_id: context.userId, kind: data.kind, content: data.content })
      .select("id, kind, content, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteUserMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_memory").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

