import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = z.enum(["web", "app"]);

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base || "site"}-${rand}`;
}

function systemPrompt(kind: "web" | "app") {
  return kind === "web"
    ? `You are a senior web designer. Return ONE complete, production-ready HTML document for a website.
Rules:
- Output raw HTML only. No markdown fences, no commentary.
- Include <!doctype html>, <head> with <title> and meta description, and responsive viewport.
- All CSS in a single <style> tag; all JS (if any) in a single <script> tag. No external build tools.
- Modern, clean, accessible design. Dark or light as fits the brief. Mobile-first responsive.
- Use semantic HTML, one <h1>, real copy relevant to the brief (no lorem ipsum).`
    : `You are a senior product engineer. Return ONE complete, production-ready HTML document that behaves like a mobile app (installable web app shell).
Rules:
- Output raw HTML only. No markdown fences, no commentary.
- Include <!doctype html>, <head> with <title>, meta description, responsive viewport and theme-color.
- App-like layout: fixed top bar, scrollable content area, bottom tab bar navigation, touch-friendly targets.
- All CSS in one <style> tag, all interactivity in one vanilla-JS <script> tag (working tab switching and state).
- Real, relevant content for the brief. Mobile-first, works on desktop too.`;
}

function cleanHtml(raw: string) {
  const stripped = raw.replace(/^\s*```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = stripped.search(/<!doctype html|<html/i);
  return start > 0 ? stripped.slice(start) : stripped;
}

export const listSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("id, kind, slug, title, prompt, published, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { sites: data ?? [] };
  });

export const getSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sites")
      .select("id, kind, slug, title, prompt, html, published, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Build not found");
    return { site: row };
  });

export const buildSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: KIND,
        title: z.string().trim().min(1).max(120),
        prompt: z.string().trim().min(10, "Describe your build in a bit more detail").max(6000),
        id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runAiText } = await import("@/lib/ai-resilient.server");
    const html = cleanHtml(
      await runAiText(
        systemPrompt(data.kind),
        `Project name: ${data.title}\n\nBrief:\n${data.prompt}`,
      ),
    );
    if (!/<html|<!doctype/i.test(html)) throw new Error("Generation failed — please try again.");

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("sites")
        .update({ title: data.title, prompt: data.prompt, html })
        .eq("id", data.id)
        .select("id, slug, kind, title, published")
        .single();
      if (error) throw new Error(error.message);
      return { site: row, html };
    }

    const { data: row, error } = await context.supabase
      .from("sites")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        prompt: data.prompt,
        slug: slugify(data.title),
        html,
      })
      .select("id, slug, kind, title, published")
      .single();
    if (error) throw new Error(error.message);
    return { site: row, html };
  });

export const setPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sites")
      .update({ published: data.published })
      .eq("id", data.id)
      .select("id, slug, published")
      .single();
    if (error) throw new Error(error.message);
    return { site: row };
  });

export const deleteSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
