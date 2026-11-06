import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Briefcase, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ToolShell, Panel } from "@/components/tool-shell";
import { generateLesson } from "@/lib/learn.functions";

const TOPICS = ["Business Basics", "Marketing", "Sales", "Branding", "Startup Ideas", "Online Business", "Freelancing", "Money Management"];

export const Route = createFileRoute("/_authenticated/learn/business")({
  head: () => ({ meta: [{ title: "Business Learning — Smart GPT" }] }),
  component: BusinessLearn,
});

function BusinessLearn() {
  const fn = useServerFn(generateLesson);
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (t: string) => fn({ data: { topic: t, kind: "business" } }),
    onSuccess: (r) => setLesson(r.lesson),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <ToolShell title="Business Learning" description="AI-generated micro-lessons. Pick a topic or type your own.">
      <Panel className="mb-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button key={t} onClick={() => { setTopic(t); mut.mutate(t); }} disabled={mut.isPending}
              className="rounded-full border border-border/60 bg-white/5 px-3 py-1.5 text-xs hover:bg-primary/15 hover:text-primary disabled:opacity-50">
              {t}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (topic.trim()) mut.mutate(topic.trim()); }} className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. how to price a freelance service"
            className="flex-1 rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          <button disabled={mut.isPending || !topic.trim()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Generate lesson
          </button>
        </form>
      </Panel>

      {lesson && (
        <Panel>
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Lesson · {topic}
          </div>
          <article className="prose-invert whitespace-pre-wrap text-sm leading-relaxed">{lesson}</article>
        </Panel>
      )}
    </ToolShell>
  );
}
