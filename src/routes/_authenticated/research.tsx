import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Loader2, Search, Image as ImageIcon, Video as VideoIcon, Link as LinkIcon,
  ExternalLink, Copy, Check, BookmarkPlus, FileText, Youtube, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ToolShell, Panel } from "@/components/tool-shell";
import { researchMedia, analyzeScriptMedia, type MediaItem, type SourceLink } from "@/lib/research.functions";
import { saveItem } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "Research Media Finder — Smart GPT" },
      { name: "description", content: "Find relevant images for any topic, or images and video clips for your own script." },
    ],
  }),
  ssr: false,
  component: ResearchPage,
});

type Tab = "topic" | "script";

type Filters = {
  freeToUse: boolean; creativeCommons: boolean; educational: boolean;
  documentary: boolean; hdOnly: boolean; verticalShorts: boolean;
};

const DEFAULT_FILTERS: Filters = {
  freeToUse: false, creativeCommons: false, educational: false,
  documentary: false, hdOnly: false, verticalShorts: false,
};

function handleErr(e: unknown) {
  const msg = e instanceof Error ? e.message : "Something went wrong";
  toast.error(
    msg.includes("402") ? "AI credits exhausted." :
    msg.includes("429") ? "Rate limit hit. Try again." :
    "Research failed",
  );
}

function ResearchPage() {
  const [tab, setTab] = useState<Tab>("topic");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [forYouTube, setForYouTube] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const researchFn = useServerFn(researchMedia);
  const scriptFn = useServerFn(analyzeScriptMedia);

  const research = useMutation({
    mutationFn: (t: string) => researchFn({ data: { topic: t, filters, forYouTube } }),
    onError: handleErr,
  });
  const scriptM = useMutation({
    mutationFn: (s: string) => scriptFn({ data: { script: s, filters } }),
    onError: handleErr,
  });

  return (
    <ToolShell
      title="Research Media Finder"
      description="Search a topic → images only. Paste your own script → images plus matching video clips, scene by scene."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <TabBtn active={tab === "topic"} onClick={() => setTab("topic")} icon={Search} label="Topic Research" />
        <TabBtn active={tab === "script"} onClick={() => setTab("script")} icon={FileText} label="Find Clips For My Script" />
      </div>

      <Panel>
        {tab === "topic" ? (
          <form onSubmit={(e) => { e.preventDefault(); const v = topic.trim(); if (v) research.mutate(v); }} className="flex flex-col gap-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter topic, keyword, fact, or video idea (e.g. Chandrayaan-3, WWII tanks, Ancient Egypt)"
              className="w-full rounded-xl border border-border bg-input/40 px-4 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={forYouTube} onChange={(e) => setForYouTube(e.target.checked)} className="h-4 w-4 accent-primary" />
                <Youtube className="h-4 w-4" /> This is for YouTube — also generate content pack
              </label>
              <button
                type="submit"
                disabled={research.isPending || !topic.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {research.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Research
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); const v = script.trim(); if (v.length >= 10) scriptM.mutate(v); }} className="flex flex-col gap-3">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your video script here. AI will split it into scenes and find matching visuals for each."
              rows={8}
              className="w-full rounded-xl border border-border bg-input/40 px-4 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={scriptM.isPending || script.trim().length < 10}
              className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {scriptM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Analyze Scenes
            </button>
          </form>
        )}

        <FilterBar filters={filters} setFilters={setFilters} />
      </Panel>

      <div className="mt-8 space-y-8">
        {tab === "topic" && research.data && <TopicResults data={research.data} />}
        {tab === "script" && scriptM.data && <ScriptResults scenes={scriptM.data.scenes} />}
      </div>
    </ToolShell>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Search; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
        active ? "bg-primary text-primary-foreground" : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function FilterBar({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const opts: { key: keyof Filters; label: string }[] = [
    { key: "freeToUse", label: "Free to Use" },
    { key: "creativeCommons", label: "Creative Commons" },
    { key: "educational", label: "Educational" },
    { key: "documentary", label: "Documentary" },
    { key: "hdOnly", label: "HD Only" },
    { key: "verticalShorts", label: "Vertical Shorts" },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
      {opts.map((o) => {
        const active = filters[o.key];
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setFilters({ ...filters, [o.key]: !active })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active ? "bg-primary/20 text-primary ring-1 ring-primary/50" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TopicResults({ data }: { data: { topic: string; summary: string; images: MediaItem[]; videos: MediaItem[]; sources: SourceLink[]; youtubePack: string | null } }) {
  return (
    <>
      {data.summary && (
        <Panel>
          <h3 className="mb-2 font-display text-lg font-semibold">AI Research Briefing</h3>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{data.summary}</pre>
        </Panel>
      )}

      {data.youtubePack && (
        <Panel>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-semibold"><Youtube className="h-5 w-5 text-primary" /> YouTube Content Pack</h3>
            <SaveBtn title={`YouTube Pack — ${data.topic}`} kind="script" category="youtube" content={{ topic: data.topic, pack: data.youtubePack }} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{data.youtubePack}</pre>
        </Panel>
      )}

      <Section title="Images" icon={ImageIcon} count={data.images.length}>
        {data.images.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.images.map((it) => <MediaCard key={it.id} item={it} topic={data.topic} />)}
          </div>
        ) : <Empty label="No images found. Try different keywords or relax filters." />}
      </Section>




      <Section title="Sources" icon={LinkIcon} count={data.sources.length}>
        {data.sources.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.sources.map((s) => (
              <div key={s.url} className="rounded-2xl border border-border/70 p-4" style={{ background: "var(--gradient-card)" }}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{s.title}</a>
                  <div className="flex gap-1">
                    <CopyBtn value={s.url} />
                    <SaveBtn title={s.title} kind="note" category="source" content={{ url: s.url, snippet: s.snippet, topic: data.topic }} />
                  </div>
                </div>
                {s.snippet && <p className="line-clamp-3 text-xs text-muted-foreground">{s.snippet}</p>}
              </div>
            ))}
          </div>
        ) : <Empty label="No sources found." />}
      </Section>
    </>
  );
}

function ScriptResults({ scenes }: { scenes: Array<{ index: number; description: string; keywords: string; images: MediaItem[]; videos: MediaItem[] }> }) {
  if (!scenes.length) return <Empty label="Couldn't parse scenes. Try a longer or clearer script." />;
  return (
    <div className="space-y-6">
      {scenes.map((s) => (
        <Panel key={s.index}>
          <div className="mb-3 flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 font-display text-sm font-bold text-primary">{s.index}</div>
            <div className="flex-1">
              <p className="font-medium">{s.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">Keywords: {s.keywords}</p>
            </div>
          </div>
          {s.images.length > 0 && (
            <>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visuals</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {s.images.map((it) => <MediaCard key={it.id} item={it} topic={s.description} compact />)}
              </div>
            </>
          )}
          {s.videos.length > 0 && (
            <>
              <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Video Refs</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {s.videos.map((it) => <MediaCard key={it.id} item={it} topic={s.description} compact />)}
              </div>
            </>
          )}
        </Panel>
      ))}
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: typeof ImageIcon; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-semibold">
        <Icon className="h-5 w-5 text-primary" /> {title}
        <span className="text-xs font-normal text-muted-foreground">({count})</span>
      </h3>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">{label}</div>;
}

function MediaCard({ item, topic, compact }: { item: MediaItem; topic: string; compact?: boolean }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border/70" style={{ background: "var(--gradient-card)" }}>
      <a href={item.link} target="_blank" rel="noreferrer" className="block aspect-video overflow-hidden bg-muted/30">
        {item.preview ? (
          <img
            src={item.preview}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            {item.type === "video" ? <VideoIcon className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
          </div>
        )}
      </a>
      <div className={compact ? "p-2" : "p-3"}>
        <p className={`line-clamp-2 font-medium ${compact ? "text-xs" : "text-sm"}`}>{item.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.source}{item.license ? ` · ${item.license}` : ""}
        </p>
        <div className="mt-2 flex gap-1">
          <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground" title="Open">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
          <CopyBtn value={item.link} small />
          <SaveBtn small title={item.title} kind={item.type === "image" ? "image" : "note"} category={item.type === "video" ? "video-ref" : "research"} content={{ ...item, topic }} />
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ value, small }: { value: string; small?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(value); setOk(true); toast.success("Link copied"); setTimeout(() => setOk(false), 1200); }}
      className={`inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground ${small ? "px-2 py-1" : "p-2"}`}
      title="Copy link"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SaveBtn({ title, kind, category, content, small }: { title: string; kind: "image" | "note" | "script"; category?: string; content: unknown; small?: boolean }) {
  const saveFn = useServerFn(saveItem);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { title: title.slice(0, 160), kind, category, content } }),
    onSuccess: () => { setSaved(true); toast.success("Saved to Vault"); },
    onError: (e) => handleErr(e),
  });
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); if (!saved) save.mutate(); }}
      disabled={save.isPending || saved}
      className={`inline-flex items-center justify-center rounded-lg border border-border bg-background/40 text-muted-foreground hover:text-foreground disabled:opacity-60 ${small ? "px-2 py-1" : "p-2"}`}
      title="Save to Vault"
    >
      {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-primary" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
    </button>
  );
}
