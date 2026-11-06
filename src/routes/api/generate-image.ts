import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const STYLE_SUFFIX: Record<string, string> = {
  auto: "",
  realistic: ", ultra-realistic photograph, natural lighting, sharp focus, 8k detail",
  cartoon: ", vibrant cartoon illustration, bold outlines, flat colors, playful",
  anime: ", high-quality anime illustration, cel shading, expressive eyes, studio ghibli style",
  thumbnail: ", YouTube thumbnail style, high contrast, dramatic lighting, bold subject centered, punchy colors, space for text overlay",
  poster: ", cinematic movie poster, dramatic composition, moody lighting, film grain, striking typography space",
  hd: ", hyper-detailed, 8k resolution, ultra sharp, professional photography, perfect lighting",
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const key = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !key) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          prompt?: string; aspect?: string; style?: string;
        };
        const promptRaw = (body.prompt ?? "").trim();
        if (!promptRaw) return new Response("Prompt required", { status: 400 });

        const aspect = body.aspect === "9:16" ? "9:16" : body.aspect === "16:9" ? "16:9" : "1:1";
        const size = aspect === "9:16" ? "1024x1536" : aspect === "16:9" ? "1536x1024" : "1024x1024";
        const styleKey = body.style && STYLE_SUFFIX[body.style] !== undefined ? body.style : "auto";
        const styledPrompt = promptRaw + STYLE_SUFFIX[styleKey];

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt: styledPrompt,
            size,
            quality: "low",
            n: 1,
            stream: true,
            partial_images: 2,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
