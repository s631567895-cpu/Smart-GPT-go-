import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Copy, Check, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CONTENT_CATEGORIES, generateStudioContent, type ContentCategory } from "@/lib/content-studio.functions";
import { saveItem, getProfile } from "@/lib/profile.functions";
import { COUNTRIES, DURATIONS, LANGUAGE_GROUPS, YOUTUBE_CATEGORIES, durationLabel } from "@/lib/creator-options";
import { SearchableSelect } from "@/components/searchable-select";
import { ToolShell, Panel } from "@/components/tool-shell";

export const Route = createFileRoute("/_authenticated/facts")({
  head: () => ({
    meta: [
      { title: "AI Content Studio — Smart GPT" },
      { name: "description", content: "Generate viral content for YouTube, Reels, blogs, ads, emails and 20+ formats with one prompt." },
    ],
  }),
  component: ContentStudioPage,
});

function ContentStudioPage() {
  const [category, setCategory] = useState<ContentCategory>("YouTube Shorts");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [ytCategory, setYtCategory] = useState<string>("Entertainment");
  const [duration, setDuration] = useState<number>(60);
  const [language, setLanguage] = useState("English");
  const [country, setCountry] = useState("");

  const genFn = useServerFn(generateStudioContent);
  const saveFn = useServerFn(saveItem);
  const profileFn = useServerFn(getProfile);
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });

  useEffect(() => {
    const p = profileData?.profile;
    if (p?.language) setLanguage(p.language);
    if (p?.country) setCountry(p.country);
  }, [profileData]);

  const mutation = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          category,
          topic: topic.trim(),
          tone: tone.trim() || undefined,
          language: language || undefined,
          country: country || undefined,
          youtubeCategory: ytCategory || undefined,
          durationSeconds: duration,
        },
      }),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(
        msg.includes("402") ? "AI credits exhausted. Add credits in workspace billing." :
        msg.includes("429") ? "Rate limit hit. Try again in a moment." :
        "Failed to generate content",
      );
    },
  });

  const [copied, setCopied] = useState(false);
  function copyAll() {
    if (!mutation.data) return;
    navigator.clipboard.writeText(mutation.data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied full content");
  }

  async function saveToVault() {
    if (!mutation.data) return;
    await saveFn({
      data: {
        kind: "script",
        category: mutation.data.category,
        title: topic.slice(0, 80) || mutation.data.category,
        content: { text: mutation.data.markdown, category: mutation.data.category, topic },
      },
    });
    toast.success("Saved to Vault");
  }

  return (
    <ToolShell
      title="AI Content Studio"
      description="Pick a format, enter a topic — get Hook, Full Content, CTA, Titles, Description, Tags, Hashtags, Thumbnail Ideas, Editing Tips & SEO Score."
    >
      <Panel>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Format</label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect
              label="Category"
              value={ytCategory}
              onChange={setYtCategory}
              options={YOUTUBE_CATEGORIES}
              placeholder="Choose a category"
              searchPlaceholder="Search categories…"
            />
            <SearchableSelect
              label="Video duration"
              value={durationLabel(duration)}
              onChange={(v) => {
                const found = DURATIONS.find((d) => d.label === v);
                if (found) setDuration(found.value);
              }}
              options={DURATIONS.map((d) => d.label)}
              placeholder="Choose duration"
              searchPlaceholder="Search durations…"
            />
            <SearchableSelect
              label="Language"
              value={language}
              onChange={setLanguage}
              groups={LANGUAGE_GROUPS}
              placeholder="Choose a language"
              searchPlaceholder="Search languages…"
            />
            <SearchableSelect
              label="Country"
              value={country}
              onChange={setCountry}
              options={COUNTRIES}
              placeholder="Choose a country"
              searchPlaceholder="Search countries…"
            />
          </div>

          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={category === "Rewrite" || category === "Humanize AI Text" || category === "Translation"
              ? "Paste text here..."
              : "Enter topic (e.g. Tiger, ISRO Chandrayaan, my SaaS launch...)"}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-input/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />

          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tone (optional): witty, serious, professional..."
            className="rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
          />

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !topic.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate {category}
          </button>
        </div>
      </Panel>

      {mutation.data && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-primary">{mutation.data.category}</div>
            <div className="flex gap-2">
              <button onClick={copyAll} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} Copy all
              </button>
              <button onClick={saveToVault} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Save className="h-3.5 w-3.5" /> Save to Vault
              </button>
            </div>
          </div>
          <Panel className="!p-5 sm:!p-7">
            <div className="prose prose-sm prose-invert max-w-none prose-headings:font-display prose-headings:mt-6 prose-headings:mb-2 prose-h2:text-primary prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-code:rounded prose-code:bg-white/10 prose-code:px-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{mutation.data.markdown}</ReactMarkdown>
            </div>
          </Panel>
        </div>
      )}
    </ToolShell>
  );
}
