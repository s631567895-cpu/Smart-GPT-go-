import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Languages, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { ToolShell, Panel } from "@/components/tool-shell";
import { generateLesson } from "@/lib/learn.functions";

const LANGS = [
  { code: "English", flag: "🇬🇧" }, { code: "Hindi", flag: "🇮🇳" },
  { code: "Spanish", flag: "🇪🇸" }, { code: "French", flag: "🇫🇷" },
  { code: "German", flag: "🇩🇪" }, { code: "Japanese", flag: "🇯🇵" }, { code: "Korean", flag: "🇰🇷" },
];
const FOCI = ["Vocabulary practice", "Speaking practice", "Grammar basics", "Daily phrases", "Restaurant conversation", "Travel essentials"];

export const Route = createFileRoute("/_authenticated/learn/language")({
  head: () => ({ meta: [{ title: "Language Learning — Smart GPT" }] }),
  component: LanguagePage,
});

function LanguagePage() {
  const fn = useServerFn(generateLesson);
  const [language, setLanguage] = useState("English");
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (t: string) => fn({ data: { topic: t, kind: "language", language } }),
    onSuccess: (r) => setLesson(r.lesson),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <ToolShell title="Language Learning" description="7 languages · vocab, speaking, grammar, conversation practice.">
      <Panel className="mb-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLanguage(l.code)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${language === l.code ? "border-primary/60 bg-primary/20 text-primary" : "border-border/60 bg-white/5 text-muted-foreground hover:text-foreground"}`}>
              {l.flag} {l.code}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FOCI.map((t) => (
            <button key={t} onClick={() => { setTopic(t); mut.mutate(t); }} disabled={mut.isPending}
              className="rounded-full border border-border/60 bg-white/5 px-3 py-1.5 text-xs hover:bg-primary/15 hover:text-primary disabled:opacity-50">
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (topic.trim()) mut.mutate(topic.trim()); }} className="flex flex-col gap-2 sm:flex-row">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. ordering coffee politely"
            className="flex-1 rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          <button disabled={mut.isPending || !topic.trim()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            Generate {language} lesson
          </button>
        </form>

        <Link to="/chat" search={{ category: "language" }} className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <MessageSquare className="h-3 w-3" /> Or open AI Conversation Practice
        </Link>
      </Panel>

      {lesson && (
        <Panel>
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {language} · {topic}
          </div>
          <article className="whitespace-pre-wrap text-sm leading-relaxed">{lesson}</article>
        </Panel>
      )}
    </ToolShell>
  );
}
