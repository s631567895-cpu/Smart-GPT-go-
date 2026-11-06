import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  topic: z.string().min(1).max(120),
  kind: z.enum(["business", "language"]),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  language: z.string().optional(),
});

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const system = data.kind === "business"
      ? "You are Smart Business Coach. Write a 5-minute Hinglish micro-lesson on the topic. Structure: ## Why it matters, ## Key concepts (3 bullets), ## Real-world example, ## Action steps (3 bullets), ## Quick quiz (3 Qs with answers at end). Practical, Indian-market focused."
      : `You are Smart Language Tutor for ${data.language ?? "English"}. Write a 5-minute beginner-friendly lesson on the topic. Structure: ## Today's focus, ## 8 useful phrases (target language → Hinglish meaning), ## Mini dialogue (5 lines), ## Practice prompts (3), ## Quick quiz (3 Qs with answers). Use the target language for examples.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt: `Topic: ${data.topic}\nLevel: ${data.level}${data.language ? `\nLanguage: ${data.language}` : ""}`,
    });
    return { lesson: text.trim() };
  });
