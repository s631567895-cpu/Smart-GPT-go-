import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
  return true;
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    return { isAdmin: Boolean(data) };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ search: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, streak_count, last_active_date, banned, created_at");

    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const q = (data.search ?? "").trim().toLowerCase();

    const users = list.users
      .map((u) => {
        const p: any = byId.get(u.id) ?? {};
        return {
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
          streak_count: p.streak_count ?? 0,
          last_active_date: p.last_active_date ?? null,
          banned: Boolean(p.banned),
        };
      })
      .filter((u) =>
        q ? u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q) : true,
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return { users, total: list.users.length };
  });

export const adminGetUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.userId;

    const [authUser, profile, threads, messages, saved, images, badges, voice] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(uid),
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin
        .from("chat_threads")
        .select("id, title, category, created_at, updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabaseAdmin
        .from("saved_items")
        .select("id, kind, title, category, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("image_history")
        .select("id, prompt, aspect, images, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin.from("user_badges").select("badge_code, earned_at").eq("user_id", uid),
      supabaseAdmin
        .from("voice_credits")
        .select("day, seconds_used")
        .eq("user_id", uid)
        .order("day", { ascending: false })
        .limit(14),
    ]);

    return {
      email: authUser.data.user?.email ?? "",
      created_at: authUser.data.user?.created_at ?? null,
      last_sign_in_at: authUser.data.user?.last_sign_in_at ?? null,
      provider: authUser.data.user?.app_metadata?.provider ?? null,
      profile: profile.data ?? null,
      threads: threads.data ?? [],
      messageCount: messages.count ?? 0,
      saved: saved.data ?? [],
      images: images.data ?? [],
      badges: badges.data ?? [],
      voice: voice.data ?? [],
    };
  });

export const adminSetBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot ban your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ banned: data.banned }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        email: z.string().trim().email().max(255),
        subject: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAdminEmail } = await import("./admin-email.server");

    const result = await sendAdminEmail({
      to: data.email,
      subject: data.subject,
      body: data.body,
    });

    const { error } = await supabaseAdmin.from("admin_messages").insert({
      sent_by: context.userId,
      to_user_id: data.userId ?? null,
      to_email: data.email,
      subject: data.subject,
      body: data.body,
      status: result.status,
      error: result.error ?? null,
    });
    if (error) throw new Error(error.message);

    return result;
  });

export const adminListMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("admin_messages")
      .select("id, to_email, subject, body, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
