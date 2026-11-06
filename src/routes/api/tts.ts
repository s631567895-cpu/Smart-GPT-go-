import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

const DAILY_CAP_SECONDS = 30;
const PER_GEN_MAX_SECONDS = 30;


export const Route = createFileRoute("/api/tts")({
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

        const body = (await request.json()) as { input?: string; voice?: string; instructions?: string };
        const input = (body.input ?? "").trim();
        if (!input) return new Response("Input required", { status: 400 });
        if (input.length > 900) {
          return new Response("Script too long — max ~30 seconds (≈900 chars).", { status: 400 });
        }
        const voice: Voice = (VOICES as readonly string[]).includes(body.voice ?? "")
          ? (body.voice as Voice)
          : "alloy";

        // Enforce the daily voice quota server-side (atomic check + reserve).
        const seconds = Math.max(1, Math.min(PER_GEN_MAX_SECONDS, Math.ceil(input.length / 15)));
        const authedSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Generate first — credits are only charged once the audio actually starts.
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input,
            voice,
            ...(body.instructions ? { instructions: body.instructions } : {}),
            stream_format: "sse",
            response_format: "mp3",
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          const status = upstream.status;
          const message =
            status === 402
              ? "Voice credits are exhausted right now. Please try again later."
              : status === 429
                ? "Voice service is busy — please try again in a few seconds."
                : status === 403 || status === 404
                  ? "Voice generation is not enabled for this workspace yet."
                  : "Voice generation failed. Please try again.";
          console.error(`TTS upstream failed [${status}]: ${detail}`);
          return new Response(message, { status: status === 402 ? 402 : status >= 500 ? 502 : status });
        }

        // Audio is coming — now reserve the user's daily quota.
        const { error: quotaErr } = await authedSupabase.rpc("consume_voice_seconds", {
          _seconds: seconds,
          _cap: DAILY_CAP_SECONDS,
        });
        if (quotaErr) {
          await upstream.body.cancel().catch(() => {});
          return new Response(
            `Daily voice limit reached (${DAILY_CAP_SECONDS}s/day). Try again tomorrow.`,
            { status: 429 },
          );
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
