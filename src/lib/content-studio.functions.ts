import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runAiText } from "./ai-resilient.server";
import { MAX_DURATION_SECONDS, durationLabel, wordBudget } from "./creator-options";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



export const CONTENT_CATEGORIES = [
  "YouTube Shorts",
  "Long YouTube Videos",
  "Instagram Reels",
  "Facebook Posts",
  "X (Twitter)",
  "LinkedIn",
  "Telegram Posts",
  "Blogs",
  "Articles",
  "Stories",
  "Emails",
  "Product Descriptions",
  "Ads",
  "Speeches",
  "Scripts",
  "News",
  "Educational Notes",
  "Quiz & MCQs",
  "Translation",
  "Rewrite",
  "Humanize AI Text",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

const Input = z.object({
  category: z.enum(CONTENT_CATEGORIES),
  topic: z.string().min(1).max(600),
  tone: z.string().max(60).optional(),
  language: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
  youtubeCategory: z.string().max(60).optional(),
  durationSeconds: z.number().int().min(15).max(MAX_DURATION_SECONDS).optional(),
});

function categoryBrief(category: ContentCategory): string {
  switch (category) {
    case "YouTube Shorts":
      return "Write a 30-45 sec Shorts script. Hook must stop the scroll in 2 seconds. Body 3-4 punchy beats. CTA to subscribe.";
    case "Long YouTube Videos":
      return "Write a 6-10 minute long-form YouTube script with intro hook, chapters, story beats, mid-video retention loops, CTA.";
    case "Instagram Reels":
      return "Write a 30-second Reel script — visual-first, snappy captions, trending audio suggestion.";
    case "Facebook Posts":
      return "Write a scroll-stopping Facebook post 100-180 words with emotion + CTA.";
    case "X (Twitter)":
      return "Write ONE viral X post under 280 chars + a 3-tweet thread variant.";
    case "LinkedIn":
      return "Write a 150-250 word LinkedIn post: hook, story, insight, CTA. Professional tone.";
    case "Telegram Posts":
      return "Write a punchy Telegram broadcast post with emojis + link CTA.";
    case "Blogs":
      return "Write a 800-1200 word SEO blog post: H1, intro, 4-6 H2 sections, conclusion, meta description.";
    case "Articles":
      return "Write a 600-900 word informative article with source-like credibility.";
    case "Stories":
      return "Write a 300-500 word narrative story with characters, conflict, resolution.";
    case "Emails":
      return "Write a marketing/outreach email: subject, preheader, body, CTA, PS.";
    case "Product Descriptions":
      return "Write a converting product description: hook, benefits (bullet), features, social proof line, CTA.";
    case "Ads":
      return "Write 3 ad variants (Facebook, Google, Instagram) with hook, body, CTA.";
    case "Speeches":
      return "Write a 3-minute inspiring speech with opening hook, 3 points, powerful close.";
    case "Scripts":
      return "Write a video/podcast script with speaker cues and scene notes.";
    case "News":
      return "Write a neutral news brief 200-300 words: headline, lead, facts, quote, context.";
    case "Educational Notes":
      return "Write structured study notes with definitions, examples, key formulas, and a 3-question recap.";
    case "Quiz & MCQs":
      return "Write 10 MCQs with 4 options each, answers, and a 1-line explanation for each.";
    case "Translation":
      return "Detect the input language and translate to the requested target language (default English + Hindi). Keep tone.";
    case "Rewrite":
      return "Rewrite the input text keeping meaning, improving clarity, flow and hook.";
    case "Humanize AI Text":
      return "Rewrite the input text so it sounds natural, human, warm, non-robotic. Vary sentence length, add small imperfections.";
  }
}

type PromptOpts = {
  tone?: string;
  language?: string;
  country?: string;
  youtubeCategory?: string;
  durationSeconds?: number;
};

const PROMPT_TEMPLATE = (category: ContentCategory, topic: string, o: PromptOpts) => `
You are Smart GPT Content Studio — a world-class content writer.

FORMAT: ${category}
${o.youtubeCategory ? `YOUTUBE CATEGORY: ${o.youtubeCategory}` : ""}
TOPIC / INPUT:
"""${topic}"""
${o.tone ? `TONE: ${o.tone}` : ""}
LANGUAGE: ${o.language ?? "English"}
${o.country ? `AUDIENCE COUNTRY: ${o.country}` : ""}
${
  o.durationSeconds
    ? `TARGET VIDEO DURATION: ${durationLabel(o.durationSeconds)} (~${wordBudget(o.durationSeconds)} spoken words). The "Full Content" section MUST be a spoken script sized to that duration — include timestamp markers like [0:00] at each beat.`
    : ""
}

TASK BRIEF: ${categoryBrief(category)}

Return the answer as MARKDOWN with EXACTLY these H2 sections in this order:

## Hook
(1-2 magnetic opening lines)

## Full Content
(the main deliverable per the brief above — use paragraphs, bullets, chapters as needed)

## CTA
(one strong call-to-action line)

## Titles
(5 catchy title options, one per line, no numbering)

## Description
(2-4 lines short description suitable for the platform)

## Tags
(comma-separated SEO tags, 10-15)

## Hashtags
(space-separated hashtags starting with #, 10-15)

## Thumbnail Ideas
(4 distinct visual thumbnail ideas, one per line: subject + expression + background + text overlay)

## Editing Tips
(4-6 concrete editing tips: cuts, b-roll, sfx, captions, pacing)

## SEO Score
Give a single integer 0-100 on its own line, then 2 bullet reasons why.

Rules:
- Write ENTIRELY in the specified language. Never mix languages (no Hinglish) unless the requested language literally is "Hinglish".
- Use references, examples and cultural context suited to the audience country.
- Respect the target duration closely.
- No preface, no epilogue outside the sections.
- Never say "as an AI".
`.trim();

export const generateStudioContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const text = await runAiText(
      undefined,
      PROMPT_TEMPLATE(data.category, data.topic, {
        tone: data.tone,
        language: data.language,
        country: data.country,
        youtubeCategory: data.youtubeCategory,
        durationSeconds: data.durationSeconds,
      }),
    );

    return { markdown: text.trim(), category: data.category, topic: data.topic };
  });
