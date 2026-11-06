import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const DAILY_CAP_SECONDS = 30;
export const PER_GEN_MAX_SECONDS = 30;

export const getVoiceCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("voice_credits")
      .select("seconds_used, day")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    const used = data?.seconds_used ?? 0;
    return {
      dailyCap: DAILY_CAP_SECONDS,
      perGenMax: PER_GEN_MAX_SECONDS,
      usedSeconds: used,
      remainingSeconds: Math.max(0, DAILY_CAP_SECONDS - used),
    };
  });

const ConsumeInput = z.object({ seconds: z.number().int().min(1).max(PER_GEN_MAX_SECONDS) });

export const consumeVoiceCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConsumeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await supabase
      .from("voice_credits")
      .select("seconds_used")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    const used = row?.seconds_used ?? 0;
    if (used + data.seconds > DAILY_CAP_SECONDS) {
      throw new Error(`Daily voice limit reached (${DAILY_CAP_SECONDS}s/day). Try tomorrow or upgrade.`);
    }
    const newUsed = used + data.seconds;
    await supabase
      .from("voice_credits")
      .upsert({ user_id: userId, day: today, seconds_used: newUsed }, { onConflict: "user_id,day" });
    return { usedSeconds: newUsed, remainingSeconds: DAILY_CAP_SECONDS - newUsed };
  });
