import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runAiText } from "./ai-resilient.server";
import { MAX_DURATION_SECONDS, durationLabel, wordBudget } from "./creator-options";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";

async function runPrompt(system: string, prompt: string) {
  return runAiText(system, prompt);
}

function parseList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)\]]+\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 20);
}

const TopicInput = z.object({ topic: z.string().min(1).max(120) });

export const generateFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You are a viral Hindi-English (Hinglish) fact writer for YouTube Shorts. Return 7 short, shocking, lesser-known facts. One fact per line. No numbering, no markdown, no extra commentary.",
      `Topic: ${data.topic}\n\nGenerate 7 viral Hinglish facts.`,
    );
    return { facts: parseList(text) };
  });

export const generateTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You write viral YouTube Shorts titles in Hinglish. Click-baity, curiosity-driven, under 70 chars. One title per line. No numbering or quotes.",
      `Topic: ${data.topic}\n\nGenerate 5 viral Hinglish titles.`,
    );
    return { titles: parseList(text) };
  });

export const generateHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You write 3-second opening hooks for YouTube Shorts in Hinglish. Punchy, shocking, makes viewer stop scrolling. One hook per line. No numbering.",
      `Topic: ${data.topic}\n\nGenerate 5 Hinglish hooks.`,
    );
    return { hooks: parseList(text) };
  });

export const generateHashtags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You generate YouTube Shorts hashtags. Return 12 hashtags, mix of broad + niche, each starting with #. One per line. No commentary.",
      `Topic: ${data.topic}`,
    );
    return {
      hashtags: parseList(text)
        .map((h) => (h.startsWith("#") ? h : `#${h.replace(/\s+/g, "")}`))
        .slice(0, 12),
    };
  });

const ScriptInput = z.object({
  topic: z.string().min(1).max(200),
  category: z.string().max(60).optional(),
  durationSeconds: z.number().int().min(15).max(MAX_DURATION_SECONDS).optional(),
  language: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
});

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScriptInput.parse(d))
  .handler(async ({ data }) => {
    const seconds = data.durationSeconds ?? 60;
    const language = data.language ?? "English";
    const short = seconds <= 60;
    const text = await runPrompt(
      `You write YouTube video scripts. Write ENTIRELY in ${language} — never mix languages (no Hinglish) unless the requested language literally is "Hinglish". ${
        data.country ? `Tailor references, examples and cultural context to viewers in ${data.country}. ` : ""
      }${data.category ? `Content category: ${data.category}. ` : ""}The script must target ${durationLabel(
        seconds,
      )} of spoken delivery (~${wordBudget(seconds)} words). ${
        short
          ? "Structure: Hook, Point 1, Point 2, Point 3, CTA — each label on its own line followed by a colon."
          : "Structure it with a Hook, clearly labelled chapters/sections with [mm:ss] timestamps, retention loops, and a CTA at the end."
      }`,
      `Topic: ${data.topic}\n\nWrite the full script now, sized to ${durationLabel(seconds)}.`,
    );
    return { script: text };
  });

function extractVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

const UrlInput = z.object({ url: z.string().url().max(500) });

export const generateFromYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UrlInput.parse(d))
  .handler(async ({ data }) => {
    const videoId = extractVideoId(data.url);
    if (!videoId) throw new Error("Invalid YouTube URL. Paste a full youtube.com or youtu.be link.");

    let title = "";
    let author = "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      );
      if (res.ok) {
        const json = (await res.json()) as { title?: string; author_name?: string };
        title = json.title ?? "";
        author = json.author_name ?? "";
      }
    } catch {
      // fall back to URL-only
    }

    const sourceDesc = title
      ? `Reference video title: "${title}"${author ? ` by ${author}` : ""}`
      : `Reference YouTube video URL: ${data.url}`;

    const text = await runPrompt(
      `You are a viral Hinglish YouTube Shorts scriptwriter. Given a reference video, infer its topic and write a fresh, ORIGINAL Shorts script in the same style. Return STRICT format with these exact labels on their own lines:

TOPIC: <one line>
SIMILAR TITLE: <one catchy Hinglish title>

SCRIPT:
Hook: <text>
Fact 1: <text>
Fact 2: <text>
Fact 3: <text>
CTA: <text>

RELATED TOPICS:
- <topic 1>
- <topic 2>
- <topic 3>
- <topic 4>
- <topic 5>`,
      `${sourceDesc}\n\nGenerate the similar Hinglish Shorts script and related topics.`,
    );

    return { videoId, sourceTitle: title, sourceAuthor: author, content: text };
  });

export const generateThumbnailText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You write ultra-short, high-contrast YouTube Shorts thumbnail text in Hinglish — max 4 words, ALL CAPS, shocking/curiosity-driven. One per line. No numbering, no quotes, no hashtags.",
      `Topic: ${data.topic}\n\nGenerate 8 thumbnail text options.`,
    );
    return { items: parseList(text).map((s) => s.toUpperCase()).slice(0, 8) };
  });

export const generateThumbnailIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopicInput.parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You design viral YouTube Shorts thumbnails. For each idea give ONE line: subject + facial expression + background + color palette + bold text overlay. Hinglish allowed. One idea per line. No numbering, no markdown.",
      `Topic: ${data.topic}\n\nGenerate 6 distinct thumbnail design ideas.`,
    );
    return { items: parseList(text).slice(0, 6) };
  });

export const generateTrending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ niche: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You suggest trending YouTube Shorts topics in Hinglish for Indian audience. Return punchy topic ideas a creator can film TODAY. One topic per line. No numbering, no markdown, no commentary.",
      `Niche: ${data.niche}\n\nGenerate 10 trending topic ideas.`,
    );
    return { items: parseList(text).slice(0, 10) };
  });

const STYLES = ["auto", "realistic", "cartoon", "anime", "thumbnail", "poster", "hd"] as const;
type Style = (typeof STYLES)[number];

const STYLE_SUFFIX: Record<Style, string> = {
  auto: "",
  realistic: ", ultra-realistic photograph, natural lighting, sharp focus, 8k detail",
  cartoon: ", vibrant cartoon illustration, bold outlines, flat colors, playful",
  anime: ", high-quality anime illustration, cel shading, expressive eyes, studio ghibli style",
  thumbnail: ", YouTube thumbnail style, high contrast, dramatic lighting, bold subject centered, punchy colors, space for text overlay",
  poster: ", cinematic movie poster, dramatic composition, moody lighting, film grain, striking typography space",
  hd: ", hyper-detailed, 8k resolution, ultra sharp, professional photography, perfect lighting",
};

const ImageInput = z.object({
  prompt: z.string().min(1).max(800),
  aspect: z.enum(["1:1", "9:16", "16:9"]).default("1:1"),
  n: z.number().int().min(1).max(4).default(4),
  style: z.enum(STYLES).default("auto"),
});

export const enhanceImagePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prompt: z.string().min(1).max(400) }).parse(d))
  .handler(async ({ data }) => {
    const text = await runPrompt(
      "You rewrite short user image prompts into vivid, detailed AI image prompts. Add subject, environment, lighting, mood, camera/style, color palette. Keep under 60 words. Return ONLY the rewritten prompt, no quotes, no preface.",
      data.prompt,
    );
    return { prompt: text.replace(/^["']|["']$/g, "").trim() };
  });

async function generateOne(key: string, prompt: string, size: string): Promise<string> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: "openai/gpt-image-2",
          prompt,
          size,
          quality: "low",
          n: 1,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
        const item = json.data?.[0];
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
        if (item?.url) return item.url;
        lastErr = "No image in response";
      } else {
        lastErr = `${res.status}: ${(await res.text()).slice(0, 200)}`;
        if (res.status === 402 || res.status === 401) break;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network error";
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`Image generation failed: ${lastErr}`);
}

export const generateImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImageInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const size = data.aspect === "9:16" ? "1024x1536" : data.aspect === "16:9" ? "1536x1024" : "1024x1024";
    const styledPrompt = data.prompt + STYLE_SUFFIX[data.style];

    const results = await Promise.all(
      Array.from({ length: data.n }, () => generateOne(key, styledPrompt, size)),
    );

    await context.supabase.from("image_history").insert({
      user_id: context.userId,
      prompt: data.prompt,
      aspect: data.aspect,
      images: results,
    });

    return { images: results, aspect: data.aspect, style: data.style };
  });

const SaveHistoryInput = z.object({
  prompt: z.string().min(1).max(800),
  aspect: z.enum(["1:1", "9:16", "16:9"]),
  images: z.array(z.string().min(1)).min(1).max(4),
});

export const saveImageHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveHistoryInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("image_history").insert({
      user_id: context.userId,
      prompt: data.prompt,
      aspect: data.aspect,
      images: data.images,
    });
    return { ok: true };
  });





