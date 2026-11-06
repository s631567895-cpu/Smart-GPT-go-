import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MonitorSmartphone,
  Rocket,
  Smartphone,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { buildSite, deleteSite, getSite, listSites, setPublished } from "@/lib/builder.functions";

type Kind = "web" | "app";

const EXAMPLES: Record<Kind, string[]> = {
  web: [
    "A one-page portfolio for a wedding photographer with gallery, pricing and contact form.",
    "A landing page for a local coffee shop with menu, hours and map section.",
  ],
  app: [
    "A habit tracker app with daily streaks, three tabs and a progress screen.",
    "An expense tracker app with add-expense form, category totals and history tab.",
  ],
};

export function SiteBuilder({ kind }: { kind: Kind }) {
  const qc = useQueryClient();
  const buildFn = useServerFn(buildSite);
  const listFn = useServerFn(listSites);
  const getFn = useServerFn(getSite);
  const publishFn = useServerFn(setPublished);
  const deleteFn = useServerFn(deleteSite);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState("");
  const [current, setCurrent] = useState<{ id: string; slug: string; published: boolean } | null>(null);

  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: () => listFn() });
  const mine = (sitesQ.data?.sites ?? []).filter((s) => s.kind === kind);

  const build = useMutation({
    mutationFn: () => buildFn({ data: { kind, title: title.trim(), prompt: prompt.trim() } }),
    onSuccess: (res) => {
      setHtml(res.html);
      setCurrent({ id: res.site.id, slug: res.site.slug, published: res.site.published });
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Build ready — preview it below.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Build failed"),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) =>
      publishFn({ data: { id: current!.id, published: next } }),
    onSuccess: (res) => {
      setCurrent((c) => (c ? { ...c, published: res.site.published } : c));
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(res.site.published ? "Published to a public link." : "Unpublished.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update publish state"),
  });

  const open = useMutation({
    mutationFn: (id: string) => getFn({ data: { id } }),
    onSuccess: ({ site }) => {
      setTitle(site.title);
      setPrompt(site.prompt);
      setHtml(site.html);
      setCurrent({ id: site.id, slug: site.slug, published: site.published });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_r, id) => {
      if (current?.id === id) {
        setCurrent(null);
        setHtml("");
      }
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
  });

  const publicUrl =
    current && typeof window !== "undefined"
      ? `${window.location.origin}/api/public/site/${current.slug}`
      : "";

  const Icon = kind === "web" ? Globe : Smartphone;
  const heading = kind === "web" ? "Create Web" : "Create App";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/60">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {kind === "web"
              ? "Describe your website. Generate, preview and publish a public link."
              : "Describe your app. Generate a working app shell, preview and publish it."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          For the best building experience, please turn on <strong>Desktop site</strong> mode in your
          browser menu before creating an app or website.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="sb-title">
            Project name
          </label>
          <input
            id="sb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "web" ? "Studio Lumen" : "Habit Tracker"}
            className="mt-1.5 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
          />

          <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor="sb-prompt">
            Description
          </label>
          <textarea
            id="sb-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="Describe pages, sections, style, colours and content..."
            className="mt-1.5 w-full resize-y rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES[kind].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border/60 px-3 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {ex.slice(0, 42)}…
              </button>
            ))}
          </div>

          <button
            onClick={() => build.mutate()}
            disabled={build.isPending || title.trim().length < 1 || prompt.trim().length < 10}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {build.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {build.isPending ? "Building…" : "Build"}
          </button>

          {current && (
            <div className="mt-5 border-t border-border/60 pt-4">
              <button
                onClick={() => publish.mutate(!current.published)}
                disabled={publish.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {current.published ? "Unpublish" : "Publish publicly"}
              </button>

              {current.published && (
                <div className="mt-3 space-y-2">
                  <p className="break-all rounded-lg border border-border/60 bg-background px-3 py-2 text-[11px] text-muted-foreground">
                    {publicUrl}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        toast.success("Link copied");
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy link
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
          {html ? (
            <iframe
              title="Preview"
              srcDoc={html}
              sandbox="allow-scripts"
              className="h-[70vh] w-full rounded-xl border border-border/60 bg-white"
            />
          ) : (
            <div className="grid h-[70vh] place-items-center rounded-xl border border-dashed border-border/60 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                {build.isPending ? "Generating your build…" : "Your preview will appear here."}
              </p>
            </div>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Your {kind === "web" ? "websites" : "apps"}</h2>
        {sitesQ.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing built yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
            {mine.map((s) => (
              <li key={s.id} className="flex items-center gap-3 bg-card/40 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.published ? "Published" : "Draft"} · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => open.mutate(s.id)}
                  className="rounded-lg border border-border/60 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  Open
                </button>
                <button
                  onClick={() => remove.mutate(s.id)}
                  aria-label="Delete build"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
