import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Sparkles, Download, Wand2, History, Trash2, Heart, Share2, Save } from "lucide-react";
import { toast } from "sonner";

import { enhanceImagePrompt, saveImageHistory } from "@/lib/minetools.functions";
import { listImages, toggleLikeImage, deleteImage } from "@/lib/profile.functions";
import { saveItem } from "@/lib/profile.functions";
import { streamImage } from "@/lib/streamImage";
import { ToolShell, Panel } from "@/components/tool-shell";

type Aspect = "1:1" | "9:16" | "16:9";
type Style = "auto" | "realistic" | "cartoon" | "anime" | "thumbnail" | "poster" | "hd";

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "1:1", label: "Square 1:1" },
  { id: "9:16", label: "Shorts 9:16" },
  { id: "16:9", label: "Wide 16:9" },
];

const STYLES: { id: Style; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "realistic", label: "Realistic" },
  { id: "hd", label: "HD" },
  { id: "thumbnail", label: "Thumbnail" },
  { id: "poster", label: "Poster" },
  { id: "cartoon", label: "Cartoon" },
  { id: "anime", label: "Anime" },
];

const aspectClass: Record<Aspect, string> = {
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};


export const Route = createFileRoute("/_authenticated/image")({
  head: () => ({
    meta: [
      { title: "AI Image Generator — Smart GPT" },
      { name: "description", content: "Generate stunning AI images with auto-prompt, history, like and share." },
    ],
  }),
  ssr: false,
  component: ImagePage,
});

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [style, setStyle] = useState<Style>("auto");
  const [live, setLive] = useState<{ src: string; final: boolean }[]>([]);
  const qc = useQueryClient();

  const listFn = useServerFn(listImages);
  const enhanceFn = useServerFn(enhanceImagePrompt);
  const saveHistFn = useServerFn(saveImageHistory);
  const likeFn = useServerFn(toggleLikeImage);
  const delFn = useServerFn(deleteImage);
  const saveFn = useServerFn(saveItem);

  const history = useQuery({ queryKey: ["image-history"], queryFn: () => listFn() });

  const gen = useMutation({
    mutationFn: async () => {
      const p = prompt.trim();
      const N = 2;
      setLive(Array.from({ length: N }, () => ({ src: "", final: false })));
      const finals = await Promise.all(
        Array.from({ length: N }, (_, idx) =>
          streamImage({ prompt: p, aspect, style }, (dataUrl, isFinal) => {
            setLive((prev) => {
              const next = prev.slice();
              next[idx] = { src: dataUrl, final: isFinal };
              return next;
            });
          }),
        ),
      );
      await saveHistFn({ data: { prompt: p, aspect, images: finals } });
      return finals;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["image-history"] });
      toast.success("Images ready");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(
        msg.includes("402") ? "AI credits exhausted." :
        msg.includes("429") ? "Rate limit hit." : "Image generation failed",
      );
    },
  });


  const enhance = useMutation({
    mutationFn: () => enhanceFn({ data: { prompt: prompt.trim() } }),
    onSuccess: (r) => { setPrompt(r.prompt); toast.success("Prompt enhanced"); },
    onError: () => toast.error("Enhance failed"),
  });

  function dl(src: string, idx: number) {
    const a = document.createElement("a");
    a.href = src; a.download = `smartgrowth-${Date.now()}-${idx}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function share(src: string, p: string) {
    try {
      if (navigator.share && src.startsWith("http")) {
        await navigator.share({ title: "AI Image", text: p, url: src });
      } else {
        await navigator.clipboard.writeText(src);
        toast.success("Image link copied");
      }
    } catch { /* user cancelled */ }
  }

  return (
    <ToolShell
      title="AI Image Generator"
      description="Prompt do — 2 stunning images. Auto-enhance, history, like & share — sab kuch."

    >
      <Panel>
        <div className="flex flex-col gap-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Cinematic Bengal tiger in misty jungle, golden hour..."
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-input/40 px-4 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Style</div>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    style === s.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAspect(a.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    aspect === a.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
                  }`}
                >{a.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => enhance.mutate()}
                disabled={!prompt.trim() || enhance.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {enhance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Auto-enhance
              </button>
              <button
                onClick={() => gen.mutate()}
                disabled={!prompt.trim() || gen.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate 2
              </button>

            </div>
          </div>
        </div>
      </Panel>

      {(gen.isPending || live.some((l) => l.src)) && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
          {live.map((l, i) => (
            <div key={i} className={`${aspectClass[aspect]} group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40`}>
              {l.src ? (
                <>
                  <img
                    src={l.src}
                    alt="Generating"
                    className={`h-full w-full object-cover transition-[filter] duration-500 ${l.final ? "blur-0" : "blur-lg scale-105"}`}
                  />
                  {l.final && (
                    <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => share(l.src, prompt)} className="grid h-7 w-7 place-items-center rounded-md bg-background/80 backdrop-blur" aria-label="Share"><Share2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => dl(l.src, i)} className="grid h-7 w-7 place-items-center rounded-md bg-background/80 backdrop-blur" aria-label="Download"><Download className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-4 w-4 text-muted-foreground" /> Your History
          </h3>
        </div>
        {history.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No images yet.</div>
        ) : (
          <div className="space-y-5">
            {history.data!.items.map((h) => {
              const a = (h.aspect as Aspect) ?? "1:1";
              const imgs = (h.images as string[]) ?? [];
              return (
                <Panel key={h.id} className="!p-4 sm:!p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{h.prompt}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => likeFn({ data: { id: h.id, liked: !h.liked } }).then(() => qc.invalidateQueries({ queryKey: ["image-history"] }))}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground"
                        aria-label="Like"
                      >
                        <Heart className={`h-4 w-4 ${h.liked ? "fill-primary text-primary" : ""}`} />
                      </button>
                      <button
                        onClick={() => saveFn({ data: { kind: "image", title: h.prompt.slice(0, 80), category: a, content: { images: imgs, prompt: h.prompt, aspect: a } } }).then(() => toast.success("Saved to Vault"))}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground"
                        aria-label="Save to Vault"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => delFn({ data: { id: h.id } }).then(() => qc.invalidateQueries({ queryKey: ["image-history"] }))}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {imgs.map((src, i) => (
                      <div key={i} className={`group relative overflow-hidden rounded-xl border border-border/60 bg-background/40 ${aspectClass[a]}`}>
                        <img src={src} alt={h.prompt} className="h-full w-full object-cover" loading="lazy" />
                        <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => share(src, h.prompt)} className="grid h-7 w-7 place-items-center rounded-md bg-background/80 backdrop-blur" aria-label="Share"><Share2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => dl(src, i)} className="grid h-7 w-7 place-items-center rounded-md bg-background/80 backdrop-blur" aria-label="Download"><Download className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </ToolShell>
  );
}
