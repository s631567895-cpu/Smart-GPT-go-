import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Type, Flame, Hash, FileText, Copy, Check, Link as LinkIcon, Youtube, Image as ImageIcon, Lightbulb, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import {
  generateTitles,
  generateHooks,
  generateHashtags,
  generateScript,
  generateFromYouTube,
  generateThumbnailText,
  generateThumbnailIdeas,
  generateTrending,
} from "@/lib/minetools.functions";
import { getProfile } from "@/lib/profile.functions";
import { COUNTRIES, DURATIONS, LANGUAGE_GROUPS, YOUTUBE_CATEGORIES, durationLabel } from "@/lib/creator-options";
import { SearchableSelect } from "@/components/searchable-select";
import { ToolShell, Panel } from "@/components/tool-shell";


export const Route = createFileRoute("/_authenticated/youtube")({
  head: () => ({
    meta: [
      { title: "YouTube Creator Tools — MineTools AI" },
      {
        name: "description",
        content:
          "Generate viral YouTube Shorts titles, hooks, hashtags, and scripts in Hinglish.",
      },
    ],
  }),
  component: YouTubePage,
});

type Tab = "title" | "hook" | "hashtag" | "script" | "fromUrl" | "thumbText" | "thumbIdea" | "trending";

const TABS: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: "title", label: "Title", icon: Type },
  { id: "hook", label: "Hook", icon: Flame },
  { id: "hashtag", label: "Hashtag", icon: Hash },
  { id: "script", label: "Script", icon: FileText },
  { id: "thumbText", label: "Thumb Text", icon: ImageIcon },
  { id: "thumbIdea", label: "Thumb Idea", icon: Lightbulb },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "fromUrl", label: "From URL", icon: Youtube },
];


function handleErr(e: unknown) {
  const msg = e instanceof Error ? e.message : "Something went wrong";
  toast.error(
    msg.includes("402")
      ? "AI credits exhausted. Add credits in workspace billing."
      : msg.includes("429")
        ? "Rate limit hit. Try again in a moment."
        : "Generation failed",
  );
}

function YouTubePage() {
  const [tab, setTab] = useState<Tab>("title");
  const [topic, setTopic] = useState("");
  const [ytCategory, setYtCategory] = useState<string>("Entertainment");
  const [duration, setDuration] = useState<number>(60);
  const [language, setLanguage] = useState("English");
  const [country, setCountry] = useState("");

  const titlesFn = useServerFn(generateTitles);
  const hooksFn = useServerFn(generateHooks);
  const hashFn = useServerFn(generateHashtags);
  const scriptFn = useServerFn(generateScript);
  const fromUrlFn = useServerFn(generateFromYouTube);
  const thumbTextFn = useServerFn(generateThumbnailText);
  const thumbIdeaFn = useServerFn(generateThumbnailIdeas);
  const trendingFn = useServerFn(generateTrending);
  const profileFn = useServerFn(getProfile);
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });

  useEffect(() => {
    const p = profileData?.profile;
    if (p?.language) setLanguage(p.language);
    if (p?.country) setCountry(p.country);
  }, [profileData]);

  const titles = useMutation({ mutationFn: (t: string) => titlesFn({ data: { topic: t } }), onError: handleErr });
  const hooks = useMutation({ mutationFn: (t: string) => hooksFn({ data: { topic: t } }), onError: handleErr });
  const hashtags = useMutation({ mutationFn: (t: string) => hashFn({ data: { topic: t } }), onError: handleErr });
  const script = useMutation({
    mutationFn: (t: string) =>
      scriptFn({
        data: {
          topic: t,
          category: ytCategory || undefined,
          durationSeconds: duration,
          language: language || undefined,
          country: country || undefined,
        },
      }),
    onError: handleErr,
  });
  const fromUrl = useMutation({ mutationFn: (u: string) => fromUrlFn({ data: { url: u } }), onError: handleErr });
  const thumbText = useMutation({ mutationFn: (t: string) => thumbTextFn({ data: { topic: t } }), onError: handleErr });
  const thumbIdea = useMutation({ mutationFn: (t: string) => thumbIdeaFn({ data: { topic: t } }), onError: handleErr });
  const trending = useMutation({ mutationFn: (t: string) => trendingFn({ data: { niche: t } }), onError: handleErr });

  const topicMutations: Record<Exclude<Tab, "fromUrl">, { isPending: boolean; mutate: (t: string) => void }> = {
    title: titles,
    hook: hooks,
    hashtag: hashtags,
    script,
    thumbText,
    thumbIdea,
    trending,
  };

  const isUrlTab = tab === "fromUrl";
  const current = isUrlTab ? fromUrl : topicMutations[tab];
  const placeholder = isUrlTab
    ? "Paste YouTube URL (e.g. https://youtu.be/xxxxxxxxxxx)"
    : tab === "trending"
      ? "Enter your niche (e.g. tech, finance, kpop)"
      : "Enter Topic (e.g. BTS)";


  return (
    <ToolShell
      title="YouTube Tools"
      description="Pick a tool, enter your topic or paste a video link."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Panel>
        {tab === "script" && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = topic.trim();
            if (!v) return;
            current.mutate(v);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            {isUrlTab && (
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={placeholder}
              className={`w-full rounded-xl border border-border bg-input/40 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30 ${
                isUrlTab ? "pl-9 pr-4" : "px-4"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={current.isPending || !topic.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {current.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate
          </button>
        </form>
      </Panel>

      <div className="mt-8">
        {tab === "title" && titles.data && <ListResults items={titles.data.titles} />}
        {tab === "hook" && hooks.data && <ListResults items={hooks.data.hooks} />}
        {tab === "hashtag" && hashtags.data && <HashtagResults items={hashtags.data.hashtags} />}
        {tab === "script" && script.data && <ScriptResult text={script.data.script} />}
        {tab === "thumbText" && thumbText.data && <ListResults items={thumbText.data.items} />}
        {tab === "thumbIdea" && thumbIdea.data && <ListResults items={thumbIdea.data.items} />}
        {tab === "trending" && trending.data && <ListResults items={trending.data.items} />}
        {tab === "fromUrl" && fromUrl.data && (
          <FromUrlResult
            videoId={fromUrl.data.videoId}
            sourceTitle={fromUrl.data.sourceTitle}
            sourceAuthor={fromUrl.data.sourceAuthor}
            content={fromUrl.data.content}
          />
        )}

      </div>
    </ToolShell>
  );
}


function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg border border-border bg-background/40 p-2 text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function ListResults({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-border/70 p-4 md:p-5"
          style={{ background: "var(--gradient-card)" }}
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
            {i + 1}
          </div>
          <p className="flex-1 text-base">{item}</p>
          <CopyBtn value={item} />
        </div>
      ))}
    </div>
  );
}

function HashtagResults({ items }: { items: string[] }) {
  const all = items.join(" ");
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Hashtags</h3>
        <CopyBtn value={all} />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((h, i) => (
          <span
            key={i}
            className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
          >
            {h}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function ScriptResult({ text }: { text: string }) {
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Shorts Script</h3>
        <CopyBtn value={text} />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-foreground/90">
        {text}
      </pre>
    </Panel>
  );
}

function FromUrlResult({
  videoId,
  sourceTitle,
  sourceAuthor,
  content,
}: {
  videoId: string;
  sourceTitle: string;
  sourceAuthor: string;
  content: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Panel className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-border/60">
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt={sourceTitle || "YouTube video"}
            className="aspect-video w-full object-cover"
          />
        </div>
        {sourceTitle && (
          <p className="line-clamp-3 text-sm font-medium text-foreground">{sourceTitle}</p>
        )}
        {sourceAuthor && (
          <p className="text-xs text-muted-foreground">by {sourceAuthor}</p>
        )}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Youtube className="h-3.5 w-3.5" /> Open on YouTube
        </a>
      </Panel>
      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Similar Script & Topics</h3>
          <CopyBtn value={content} />
        </div>
        <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-foreground/90">
          {content}
        </pre>
      </Panel>
    </div>
  );
}

