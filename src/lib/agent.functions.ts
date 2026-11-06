import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAgent(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_agent_user", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const checkAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_agent_user", { _user_id: context.userId });
    return { isAgent: Boolean(data) };
  });

export const listAgentPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgent(context);
    const { data, error } = await context.supabase
      .from("agent_posts")
      .select("id, title, description, tags, images, understood, understanding, created_at")
      .order("title", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return { posts: data ?? [] };
  });

/* ------------------------------------------------------------------ */
/* Light — behaviour rules                                             */
/* ------------------------------------------------------------------ */

const RULE_KIND = z.enum(["do", "dont", "tone", "where"]);

export const listAgentRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgent(context);
    const { data, error } = await context.supabase
      .from("agent_rules")
      .select("id, kind, rule, created_at")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rules: data ?? [] };
  });

export const addAgentRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: RULE_KIND.default("do"), rule: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAgent(context);
    const { data: row, error } = await context.supabase
      .from("agent_rules")
      .insert({ user_id: context.userId, kind: data.kind, rule: data.rule.trim() })
      .select("id, kind, rule, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAgentRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgent(context);
    const { error } = await context.supabase.from("agent_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Teaching                                                            */
/* ------------------------------------------------------------------ */

export const createAgentPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().max(200).default(""),
        description: z.string().min(1, "Description required"),
        tags: z.array(z.string().min(1).max(80)).max(500).default([]),
        images: z.array(z.string().min(1)).max(20).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAgent(context);
    const title = (data.title.trim() || data.description.trim().split("\n")[0] || "Untitled").slice(0, 200);

    // Robot-style comprehension check: the agent reads the lesson and says
    // whether it understood it, or asks to be taught again.
    let understood = false;
    let understanding = "";
    try {
      const { runAiText } = await import("@/lib/ai-resilient.server");
      const out = await runAiText(
        "You are Agent Mind, a robot learner. You read a lesson and decide if it is clear enough to act on later. Answer STRICTLY as JSON.",
        `Lesson title: ${title}
Tags: ${data.tags.join(", ") || "none"}
Attached images: ${data.images.length}
Lesson text:
"""${data.description.slice(0, 6000)}"""

Decide:
- understood = true only if you can clearly explain what to say / do when a user asks about this.
- If anything is vague, contradictory or incomplete, understood = false and say exactly what confused you.

Return ONLY JSON: {"understood": true|false, "summary": "one or two short lines in the same language as the lesson"}`,
      );
      const match = out.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { understood?: boolean; summary?: string };
        understood = Boolean(parsed.understood);
        understanding = String(parsed.summary ?? "").slice(0, 800);
      }
    } catch {
      understood = false;
      understanding = "";
    }
    if (!understanding) {
      understood = false;
      understanding = "Mujhe samajh nahi aaya — please ise dobara aur simple tareeke se samjhaao.";
    }

    const { data: row, error } = await context.supabase
      .from("agent_posts")
      .insert({
        user_id: context.userId,
        title,
        description: data.description,
        tags: data.tags,
        images: data.images,
        understood,
        understanding,
      })
      .select("id, title, description, tags, images, understood, understanding, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAgentPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgent(context);
    const { error } = await context.supabase.from("agent_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearAgentPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgent(context);
    const { error } = await context.supabase.from("agent_posts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Agent Mind answering                                                */
/* ------------------------------------------------------------------ */

type MindAnswer = {
  matched: boolean;
  title: string;
  reply: string;
  tags: string[];
  images: string[];
};

async function answerFromKnowledge(message: string): Promise<MindAnswer> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runAiText } = await import("@/lib/ai-resilient.server");

  const [{ data: posts, error }, { data: rules }] = await Promise.all([
    supabaseAdmin.from("agent_posts").select("id, title, description, tags, images, understood").limit(500),
    supabaseAdmin.from("agent_rules").select("kind, rule").limit(500),
  ]);
  if (error) throw new Error(error.message);

  const empty: MindAnswer = { matched: false, title: "", reply: "", tags: [], images: [] };
  if (!posts?.length) return empty;

  const index = posts
    .map(
      (p: any, i: number) =>
        `#${i} | title: ${p.title} | tags: ${(p.tags ?? []).join(", ")} | text: ${String(p.description).slice(0, 600)}`,
    )
    .join("\n---\n");

  let pick = -1;
  try {
    const out = await runAiText(
      "You are a strict matcher. You never write your own answer. You only choose the single best matching entry.",
      `User message:\n"""${message}"""\n\nEntries:\n${index}\n\nReturn ONLY the number of the best matching entry (e.g. 3). If nothing matches the user's message, return -1.`,
    );
    const m = out.match(/-?\d+/);
    pick = m ? Number(m[0]) : -1;
  } catch {
    pick = -1;
  }

  if (pick < 0 || pick >= posts.length) {
    const words = message.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    let best = -1;
    let bestScore = 0;
    posts.forEach((p: any, i: number) => {
      const hay = `${p.title} ${(p.tags ?? []).join(" ")} ${p.description}`.toLowerCase();
      const score = words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    pick = bestScore > 0 ? best : -1;
  }

  if (pick < 0) return empty;

  const post: any = posts[pick];
  const paths = (post.images ?? []) as string[];
  const urls: string[] = [];
  for (const path of paths) {
    const { data: signed } = await supabaseAdmin.storage.from("agent-images").createSignedUrl(path, 60 * 60);
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }

  // Apply the Light rules on top of the stored answer.
  let reply = String(post.description);
  const ruleLines = (rules ?? []) as { kind: string; rule: string }[];
  if (ruleLines.length) {
    const rulesText = ruleLines.map((r) => `- [${r.kind}] ${r.rule}`).join("\n");
    try {
      reply = await runAiText(
        `You are Agent Mind. You must answer ONLY using the stored answer given to you — never invent new facts. Rewrite/deliver it while strictly following these behaviour rules:\n${rulesText}`,
        `User message:\n"""${message}"""\n\nStored answer:\n"""${String(post.description).slice(0, 6000)}"""\n\nReply to the user in their own language style, following the rules. Keep all the stored facts intact.`,
      );
    } catch {
      reply = String(post.description);
    }
  }

  return {
    matched: true,
    title: String(post.title),
    reply,
    tags: (post.tags ?? []) as string[],
    images: urls,
  };
}

/** Public Agent Mind: answers the user and stores the conversation. */
export const askAgentMind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ message: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const answer = await answerFromKnowledge(data.message);
    const text = answer.matched ? answer.reply : "Mujhe samajh nahi aaya — is baare mein mujhe abhi kuch sikhaya nahi gaya hai.";

    await context.supabase.from("agent_mind_messages").insert([
      { user_id: context.userId, role: "user", content: data.message, images: [] },
      { user_id: context.userId, role: "agent", content: text, images: answer.images },
    ]);

    return { ...answer, reply: text };
  });

export const getMindHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_mind_messages")
      .select("id, role, content, images, created_at")
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const clearMindHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("agent_mind_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Studio preview: agent-only test run, nothing is stored. */
export const previewAgentMind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ message: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgent(context);
    const answer = await answerFromKnowledge(data.message);
    return {
      ...answer,
      reply: answer.matched ? answer.reply : "Mujhe samajh nahi aaya — is topic par mujhe abhi tak kuch sikhaya nahi gaya.",
    };
  });
