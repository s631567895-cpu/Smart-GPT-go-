import { generateText } from "ai";
import { gatewayProvider } from "./ai-resilient.server";

const MODEL = "openai/gpt-6-astra";

export type Lang = { code: string; name: string; instructions: string };

/** Translate the original Hindi into one target language. Translation only — MindLM answers stay your own. */
export async function translateHindi(hindi: string, lang: Lang): Promise<string> {
  const gateway = gatewayProvider();
  const system = [
    `You are a precise translator. Translate the user's Hindi text into ${lang.name}.`,
    "Preserve the exact meaning. Keep all names, numbers, dates, scientific terms, measurements, facts and technical details.",
    "Do not add any fact that is not in the original. Do not remove any information.",
    "Return ONLY the translated text, no notes, no quotes, no explanations.",
    lang.instructions,
  ].filter(Boolean).join("\n");
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const { text } = await generateText({
        model: gateway(MODEL),
        system,
        prompt: hindi,
        providerOptions: { lovable: { reasoningEffort: "low" } },
      });
      const out = text.trim();
      if (out) return out;
      lastErr = new Error("Empty translation");
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/429|5\d\d|rate/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/402|credit/i.test(msg)) throw new Error("AI credits are used up for now.");
  if (/429|rate/i.test(msg)) throw new Error("AI is busy — retry in a moment.");
  throw new Error("Translation failed.");
}

const DEV_DIGITS = "०१२३४५६७८९";
function numbers(s: string): string[] {
  const norm = s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
  return norm.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/** Quality check: every number in the Hindi must survive, and length must be plausible. */
export function qualityCheck(hindi: string, out: string): "completed" | "needs_review" {
  const outNums = new Set(numbers(out).map((n) => n.replace(/,/g, "")));
  for (const n of numbers(hindi)) if (!outNums.has(n.replace(/,/g, ""))) return "needs_review";
  const ratio = out.length / Math.max(1, hindi.length);
  if (ratio < 0.25 || ratio > 4) return "needs_review";
  return "completed";
}

export type KnowledgeFields = { subtopic: string; title: string; content: string; tags: string[] };

/** Translate a heading or knowledge entry field-by-field via JSON, keeping structure identical. */
export async function translateFields<T extends Record<string, string | string[]>>(src: T, lang: Lang): Promise<T> {
  const gateway = gatewayProvider();
  const system = [
    `You are a precise translator. Translate every string value in the given JSON (written mostly in Hindi) into ${lang.name}.`,
    "Keep the exact same JSON keys and structure. Arrays stay arrays with the same number of items.",
    "Preserve meaning, names, numbers, dates, scientific terms and facts. Do not add or remove information.",
    "Empty strings stay empty. Return ONLY valid JSON, no code fences.",
    lang.instructions,
  ].filter(Boolean).join("\n");
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const { text } = await generateText({
        model: gateway(MODEL),
        system,
        prompt: JSON.stringify(src),
        providerOptions: { lovable: { reasoningEffort: "low" } },
      });
      const raw = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      const out = JSON.parse(raw) as T;
      for (const k of Object.keys(src)) if (!(k in out)) throw new Error("Missing field " + k);
      return out;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/402|credit/i.test(msg)) throw new Error("AI credits are used up for now.");
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : "Translation failed.");
}
