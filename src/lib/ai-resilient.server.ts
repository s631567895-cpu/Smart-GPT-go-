import { generateText } from "ai";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/**
 * Model fallback chain. If one model is overloaded / rate-limited / erroring,
 * the next one is tried automatically so the app never shows "something went wrong".
 */
export const MODEL_CHAIN = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5.6-sol",
] as const;

export function gatewayProvider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured yet. Please try again in a moment.");
  return createLovableAiGatewayProvider(key);
}

export function modelOptions(model: string) {
  return model.startsWith("openai/gpt-5.6")
    ? { providerOptions: { lovable: { reasoningEffort: "none" as const } } }
    : {};
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function friendly(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|rate limit/i.test(msg)) {
    return new Error("AI is busy right now — please try again in a few seconds.");
  }
  if (/402|credit/i.test(msg)) {
    return new Error("AI usage limit reached for now. Please try again later.");
  }
  return new Error("AI could not complete this request. Please try again.");
}

/**
 * Non-streaming text generation with per-model retries and automatic
 * fallback across the model chain.
 */
export async function runAiText(
  system: string | undefined,
  prompt: string,
  opts: { attemptsPerModel?: number; models?: readonly string[] } = {},
): Promise<string> {
  const gateway = gatewayProvider();
  const models = opts.models ?? MODEL_CHAIN;
  const attempts = opts.attemptsPerModel ?? 2;
  let lastError: unknown;

  for (const model of models) {
    for (let i = 0; i < attempts; i++) {
      try {
        const { text } = await generateText({
          model: gateway(model),
          ...(system ? { system } : {}),
          prompt,
          ...modelOptions(model),
        });
        const out = text.trim();
        if (out) return out;
        lastError = new Error("Empty response");
      } catch (error) {
        lastError = error;
      }
      await sleep(400 * (i + 1));
    }
  }
  throw friendly(lastError);
}
