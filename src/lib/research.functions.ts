import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runAiText } from "./ai-resilient.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";

async function runAi(system: string, prompt: string) {
  return runAiText(system, prompt);
}

export type MediaItem = {
  id: string;
  type: "image" | "video";
  title: string;
  source: string; // provider name
  preview: string; // thumbnail url
  link: string; // page/watch url
  license?: string;
  hd?: boolean;
  vertical?: boolean;
  category?: string; // documentary/educational/etc
};

export type SourceLink = { title: string; url: string; snippet?: string };

const Filters = z
  .object({
    freeToUse: z.boolean().optional(),
    creativeCommons: z.boolean().optional(),
    educational: z.boolean().optional(),
    documentary: z.boolean().optional(),
    hdOnly: z.boolean().optional(),
    verticalShorts: z.boolean().optional(),
  })
  .default({});

type FiltersT = z.infer<typeof Filters>;

// ---------- Providers (no API keys required) ----------

async function fetchWikimediaImages(q: string, limit = 14): Promise<MediaItem[]> {
  try {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${q} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "480",
      format: "json",
      origin: "*",
    }).toString();
    const r = await fetch(url.toString(), { headers: { "User-Agent": "SmartGrowth/1.0" } });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      query?: { pages?: Record<string, {
        pageid: number; title: string;
        imageinfo?: Array<{ url: string; thumburl?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }>;
      }> };
    };
    const pages = Object.values(j.query?.pages ?? {});
    return pages
      .map((p): MediaItem | null => {
        const info = p.imageinfo?.[0];
        if (!info) return null;
        const license = info.extmetadata?.LicenseShortName?.value?.replace(/<[^>]+>/g, "");
        const w = info.width ?? 0;
        const h = info.height ?? 0;
        return {
          id: `wm-${p.pageid}`,
          type: "image",
          title: p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
          source: "Wikimedia Commons",
          preview: info.thumburl ?? info.url,
          link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          license,
          hd: w >= 1280 || h >= 720,
          vertical: h > w,
          category: "educational",
        };
      })
      .filter((x): x is MediaItem => !!x);
  } catch {
    return [];
  }
}

async function fetchOpenverseImages(q: string, limit = 12): Promise<MediaItem[]> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${limit}&license_type=all-cc`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: Array<{ id: string; title?: string; thumbnail?: string; url?: string; foreign_landing_url?: string; source?: string; license?: string; width?: number; height?: number }> };
    return (j.results ?? []).map((it): MediaItem => ({
      id: `ov-${it.id}`,
      type: "image",
      title: it.title || "Untitled",
      source: `Openverse · ${it.source ?? "CC"}`,
      preview: it.thumbnail || it.url || "",
      link: it.foreign_landing_url || it.url || "",
      license: it.license?.toUpperCase(),
      hd: (it.width ?? 0) >= 1280,
      vertical: (it.height ?? 0) > (it.width ?? 0),
      category: "creative-commons",
    }));
  } catch {
    return [];
  }
}

async function fetchArchiveVideos(q: string, limit = 14): Promise<MediaItem[]> {
  try {
    const params = new URLSearchParams({
      q: `${q} AND mediatype:(movies)`,
      "fl[]": "identifier",
      rows: String(limit),
      output: "json",
      sort: "downloads desc",
    });
    // add extra fields
    params.append("fl[]", "title");
    params.append("fl[]", "description");
    params.append("fl[]", "subject");
    params.append("fl[]", "licenseurl");
    const url = `https://archive.org/advancedsearch.php?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = (await r.json()) as { response?: { docs?: Array<{ identifier: string; title?: string; description?: string; subject?: string | string[]; licenseurl?: string }> } };
    return (j.response?.docs ?? []).map((d): MediaItem => {
      const subj = Array.isArray(d.subject) ? d.subject.join(", ") : d.subject || "";
      const isDoc = /document/i.test(subj) || /document/i.test(String(d.description ?? ""));
      const isHist = /histor/i.test(subj) || /histor/i.test(String(d.description ?? ""));
      return {
        id: `ia-${d.identifier}`,
        type: "video",
        title: d.title || d.identifier,
        source: "Internet Archive",
        preview: `https://archive.org/services/img/${d.identifier}`,
        link: `https://archive.org/details/${d.identifier}`,
        license: d.licenseurl ? "CC / Public Domain" : undefined,
        hd: true,
        vertical: false,
        category: isDoc ? "documentary" : isHist ? "historical" : "educational",
      };
    });
  } catch {
    return [];
  }
}

async function fetchWikipediaSources(q: string, limit = 8): Promise<SourceLink[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = (await r.json()) as { query?: { search?: Array<{ title: string; snippet?: string }> } };
    return (j.query?.search ?? []).map((s) => ({
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/\s/g, "_"))}`,
      snippet: (s.snippet ?? "").replace(/<[^>]+>/g, ""),
    }));
  } catch {
    return [];
  }
}

function applyFilters(items: MediaItem[], f: FiltersT): MediaItem[] {
  return items.filter((it) => {
    if (f.hdOnly && !it.hd) return false;
    if (f.verticalShorts && !it.vertical) return false;
    if (f.creativeCommons && !(it.license && /cc|public/i.test(it.license))) return false;
    if (f.freeToUse && !it.license) return false;
    if (f.documentary && it.category !== "documentary") return false;
    if (f.educational && !(it.category === "educational" || it.category === "documentary" || it.category === "historical")) return false;
    return true;
  });
}

// ---------- Server functions ----------

export const researchMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      topic: z.string().min(1).max(400),
      filters: Filters,
      forYouTube: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = data.topic.trim();

    // Topic search returns IMAGES ONLY (videos are only offered for user scripts).
    const [wm, ov, sources, aiSummary, ytPack] = await Promise.all([
      fetchWikimediaImages(q, 14),
      fetchOpenverseImages(q, 12),
      fetchWikipediaSources(q, 8),
      runAi(
        "You are a research assistant. Write a concise 5-7 line briefing about the topic. Include key facts and 3 visual keywords a video editor should search for. Return plain text.",
        q,
      ).catch(() => ""),
      data.forYouTube
        ? runAi(
            `You create a complete YouTube content pack. Return STRICT sections with exact labels on their own line:

HOOK:
<one line>

TITLE:
<one catchy title>

SCRIPT:
<45-60s Shorts script>

DESCRIPTION:
<2-3 lines>

TAGS:
<comma-separated 10 tags>

HASHTAGS:
<space-separated 10 hashtags starting with #>

THUMBNAIL IDEAS:
- <idea 1>
- <idea 2>
- <idea 3>

EDITING SUGGESTIONS:
- <suggestion 1>
- <suggestion 2>
- <suggestion 3>`,
            q,
          ).catch(() => "")
        : Promise.resolve(""),
    ]);

    const images = applyFilters([...wm, ...ov], data.filters).slice(0, 12);

    return {
      topic: q,
      summary: aiSummary,
      images,
      videos: [] as MediaItem[],
      sources,
      youtubePack: ytPack || null,
    };
  });

export const analyzeScriptMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      script: z.string().min(10).max(6000),
      filters: Filters,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await runAi(
      `Split this video script into 4-8 sequential scenes. For each scene return one line:
SCENE | <one sentence describing what happens> | <3-5 comma-separated visual search keywords>
No other text.`,
      data.script,
    );

    const scenes = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.toUpperCase().startsWith("SCENE"))
      .map((l) => {
        const parts = l.split("|").map((p) => p.trim());
        return { description: parts[1] ?? "", keywords: parts[2] ?? "" };
      })
      .filter((s) => s.description && s.keywords)
      .slice(0, 8);

    const enriched = await Promise.all(
      scenes.map(async (s, idx) => {
        const q = s.keywords;
        const [imgs, vids] = await Promise.all([
          fetchWikimediaImages(q, 4),
          fetchArchiveVideos(q, 3),
        ]);
        return {
          index: idx + 1,
          description: s.description,
          keywords: s.keywords,
          images: applyFilters(imgs, data.filters).slice(0, 4),
          videos: applyFilters(vids, data.filters).slice(0, 3),
        };
      }),
    );

    return { scenes: enriched };
  });
