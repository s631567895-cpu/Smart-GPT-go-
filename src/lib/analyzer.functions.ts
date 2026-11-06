import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { runAiText } from "./ai-resilient.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";
const YT = "https://www.googleapis.com/youtube/v3";

// ------------------------- Types -------------------------

export type ChannelInfo = {
  id: string;
  title: string;
  handle?: string;
  description: string;
  thumbnail: string;
  country?: string;
  publishedAt: string;
  subscribers: number;
  hiddenSubscribers: boolean;
  views: number;
  videoCount: number;
  uploadsPlaylistId: string;
};

export type VideoStat = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  durationSec: number;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  tags: string[];
};

export type ChannelMetrics = {
  avgViews: number;
  medianViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number; // (likes+comments)/views
  uploadFrequencyPerWeek: number;
  shortsCount: number;
  longCount: number;
  shortsAvgViews: number;
  longAvgViews: number;
  bestUploadDay: string;
  bestUploadHourUTC: number;
  daysSinceLastUpload: number;
  viewsPerSubRatio: number;
  monthlyViews: { month: string; views: number; uploads: number }[];
  topVideos: VideoStat[];
  worstVideos: VideoStat[];
  bestShorts: VideoStat[];
  recent: VideoStat[];
};

export type Scores = {
  health: number;
  performance: number;
  growth: number;
  monetization: number;
  seo: number;
  viral: number;
  consistency: number;
};

export type Issue = {
  key: string;
  title: string;
  severity: "low" | "medium" | "high";
  priority: number;
  impact: string;
  explanation: string;
  actions: string[];
};

export type GrowthPlan = {
  summary: string;
  thirtyDayPlan: { week: number; focus: string; tasks: string[] }[];
  weeklySchedule: { day: string; slotUTC: string; format: string; topic: string }[];
  contentCalendar: { date: string; title: string; format: string; hook: string }[];
  trendingTopics: string[];
  videoIdeas: { title: string; angle: string; format: string }[];
  thumbnailSuggestions: string[];
  seoImprovements: string[];
  scriptRecommendations: string[];
};

export type AnalyzerReport = {
  channel: ChannelInfo;
  metrics: ChannelMetrics;
  scores: Scores;
  issues: Issue[];
  plan: GrowthPlan;
  disclaimer: string;
};

// ------------------------- Helpers -------------------------

function parseISODuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("Missing YOUTUBE_API_KEY. Add it in project secrets.");
  const url = new URL(`${YT}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function resolveChannelId(input: string): Promise<string> {
  const q = input.trim();
  // Direct channel id
  if (/^UC[\w-]{20,}$/.test(q)) return q;
  // URL forms
  const urlMatch = q.match(/youtube\.com\/(?:channel\/(UC[\w-]{20,})|@([\w.\-]+)|c\/([\w.\-]+)|user\/([\w.\-]+))/i);
  const handle = urlMatch?.[2] ?? (q.startsWith("@") ? q.slice(1) : undefined);
  const legacy = urlMatch?.[3] ?? urlMatch?.[4];
  if (urlMatch?.[1]) return urlMatch[1];

  if (handle) {
    const r = await ytFetch<any>("channels", { part: "id", forHandle: `@${handle}` });
    const id = r.items?.[0]?.id;
    if (id) return id;
  }
  // Fallback: search
  const searchQ = legacy ?? q;
  const s = await ytFetch<any>("search", { part: "snippet", type: "channel", q: searchQ, maxResults: "1" });
  const id = s.items?.[0]?.snippet?.channelId ?? s.items?.[0]?.id?.channelId;
  if (!id) throw new Error("Channel not found. Try a full URL, @handle, or channel ID.");
  return id;
}

async function fetchChannel(channelId: string): Promise<ChannelInfo> {
  const r = await ytFetch<any>("channels", {
    part: "snippet,statistics,contentDetails,brandingSettings",
    id: channelId,
  });
  const item = r.items?.[0];
  if (!item) throw new Error("Channel data unavailable.");
  return {
    id: item.id,
    title: item.snippet?.title ?? "",
    handle: item.snippet?.customUrl,
    description: item.snippet?.description ?? "",
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
    country: item.snippet?.country,
    publishedAt: item.snippet?.publishedAt,
    subscribers: Number(item.statistics?.subscriberCount ?? 0),
    hiddenSubscribers: !!item.statistics?.hiddenSubscriberCount,
    views: Number(item.statistics?.viewCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

async function fetchRecentVideoIds(uploadsPlaylistId: string, limit = 50): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < limit) {
    const r: any = await ytFetch("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const it of r.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) ids.push(id);
      if (ids.length >= limit) break;
    }
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

async function fetchVideos(ids: string[]): Promise<VideoStat[]> {
  const out: VideoStat[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const r: any = await ytFetch("videos", {
      part: "snippet,contentDetails,statistics",
      id: batch.join(","),
    });
    for (const it of r.items ?? []) {
      const durationSec = parseISODuration(it.contentDetails?.duration ?? "PT0S");
      out.push({
        id: it.id,
        title: it.snippet?.title ?? "",
        description: it.snippet?.description ?? "",
        publishedAt: it.snippet?.publishedAt ?? "",
        thumbnail:
          it.snippet?.thumbnails?.medium?.url ??
          it.snippet?.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
        durationSec,
        isShort: durationSec > 0 && durationSec <= 60,
        views: Number(it.statistics?.viewCount ?? 0),
        likes: Number(it.statistics?.likeCount ?? 0),
        comments: Number(it.statistics?.commentCount ?? 0),
        tags: it.snippet?.tags ?? [],
      });
    }
  }
  return out;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function computeMetrics(channel: ChannelInfo, videos: VideoStat[]): ChannelMetrics {
  const sorted = [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const shorts = sorted.filter((v) => v.isShort);
  const longs = sorted.filter((v) => !v.isShort);

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const views = sorted.map((v) => v.views);

  // Upload frequency: over last 60 days
  const now = Date.now();
  const sixtyDaysAgo = now - 60 * 86400_000;
  const recentUploads = sorted.filter((v) => new Date(v.publishedAt).getTime() >= sixtyDaysAgo);
  const uploadFrequencyPerWeek = +(recentUploads.length / (60 / 7)).toFixed(2);

  // Best day/hour
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayScore = new Array(7).fill(0);
  const hourScore = new Array(24).fill(0);
  for (const v of sorted) {
    const d = new Date(v.publishedAt);
    dayScore[d.getUTCDay()] += v.views;
    hourScore[d.getUTCHours()] += v.views;
  }
  const bestDayIdx = dayScore.indexOf(Math.max(...dayScore));
  const bestHour = hourScore.indexOf(Math.max(...hourScore));

  // Monthly performance (last 6 months)
  const monthly: Record<string, { views: number; uploads: number }> = {};
  for (const v of sorted) {
    const d = new Date(v.publishedAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly[key] ??= { views: 0, uploads: 0 };
    monthly[key].views += v.views;
    monthly[key].uploads += 1;
  }
  const monthlyViews = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => ({ month, views: v.views, uploads: v.uploads }));

  const totalViews = sorted.reduce((a, b) => a + b.views, 0);
  const totalLikes = sorted.reduce((a, b) => a + b.likes, 0);
  const totalComments = sorted.reduce((a, b) => a + b.comments, 0);
  const engagementRate = totalViews > 0 ? +(((totalLikes + totalComments) / totalViews) * 100).toFixed(2) : 0;

  const daysSinceLastUpload = sorted[0]
    ? Math.round((now - new Date(sorted[0].publishedAt).getTime()) / 86400_000)
    : 999;

  return {
    avgViews: avg(views),
    medianViews: median(views),
    avgLikes: avg(sorted.map((v) => v.likes)),
    avgComments: avg(sorted.map((v) => v.comments)),
    engagementRate,
    uploadFrequencyPerWeek,
    shortsCount: shorts.length,
    longCount: longs.length,
    shortsAvgViews: avg(shorts.map((v) => v.views)),
    longAvgViews: avg(longs.map((v) => v.views)),
    bestUploadDay: dayNames[bestDayIdx] ?? "Sat",
    bestUploadHourUTC: bestHour,
    daysSinceLastUpload,
    viewsPerSubRatio: channel.subscribers ? +(channel.views / channel.subscribers).toFixed(2) : 0,
    monthlyViews,
    topVideos: [...sorted].sort((a, b) => b.views - a.views).slice(0, 10),
    worstVideos: [...sorted].sort((a, b) => a.views - b.views).slice(0, 5),
    bestShorts: [...shorts].sort((a, b) => b.views - a.views).slice(0, 8),
    recent: sorted.slice(0, 10),
  };
}

function computeScores(channel: ChannelInfo, m: ChannelMetrics): Scores {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const subs = channel.subscribers;

  const consistency = clamp(
    (Math.min(m.uploadFrequencyPerWeek, 3) / 3) * 70 + (m.daysSinceLastUpload <= 7 ? 30 : m.daysSinceLastUpload <= 21 ? 15 : 0),
  );
  const performance = clamp(
    Math.log10(Math.max(1, m.avgViews)) * 18 +
      Math.log10(Math.max(1, m.medianViews)) * 8 +
      m.engagementRate * 2,
  );
  const growth = clamp(
    (m.viewsPerSubRatio > 0 ? Math.min(60, m.viewsPerSubRatio * 1.5) : 0) +
      (subs > 0 ? Math.min(40, (m.avgViews / Math.max(1, subs)) * 100) : 20),
  );
  const monetization = clamp(
    (subs >= 1000 ? 40 : (subs / 1000) * 40) +
      (m.longCount >= 10 ? 30 : (m.longCount / 10) * 30) +
      (m.avgViews >= 1000 ? 20 : (m.avgViews / 1000) * 20) +
      (m.uploadFrequencyPerWeek >= 1 ? 10 : m.uploadFrequencyPerWeek * 10),
  );
  const seo = clamp(
    (m.recent.filter((v) => v.tags.length >= 5).length / Math.max(1, m.recent.length)) * 40 +
      (m.recent.filter((v) => v.description.length > 300).length / Math.max(1, m.recent.length)) * 30 +
      (channel.description.length > 200 ? 30 : (channel.description.length / 200) * 30),
  );
  const viral = clamp(
    Math.log10(Math.max(1, Math.max(...m.topVideos.map((v) => v.views), 1))) * 15 +
      (m.shortsCount > 0 ? Math.log10(Math.max(1, m.shortsAvgViews)) * 8 : 0) +
      m.engagementRate * 3,
  );
  const health = clamp(performance * 0.25 + growth * 0.2 + consistency * 0.2 + seo * 0.15 + monetization * 0.1 + viral * 0.1);
  return { health, performance, growth, monetization, seo, viral, consistency };
}

// ------------------------- AI Layer -------------------------

async function aiInsights(
  channel: ChannelInfo,
  m: ChannelMetrics,
  scores: Scores,
): Promise<{ issues: Issue[]; plan: GrowthPlan }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);

  const topSample = m.topVideos.slice(0, 5).map((v) => ({ title: v.title, views: v.views, likes: v.likes }));
  const recentSample = m.recent.slice(0, 8).map((v) => ({
    title: v.title,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    isShort: v.isShort,
    tags: v.tags.slice(0, 6),
  }));

  const context = {
    channel: {
      title: channel.title,
      subs: channel.subscribers,
      totalViews: channel.views,
      videos: channel.videoCount,
      country: channel.country,
      descLen: channel.description.length,
    },
    metrics: {
      avgViews: m.avgViews,
      medianViews: m.medianViews,
      engagementRate: m.engagementRate,
      uploadsPerWeek: m.uploadFrequencyPerWeek,
      shorts: m.shortsCount,
      longs: m.longCount,
      shortsAvg: m.shortsAvgViews,
      longAvg: m.longAvgViews,
      bestDay: m.bestUploadDay,
      bestHourUTC: m.bestUploadHourUTC,
      daysSinceLastUpload: m.daysSinceLastUpload,
    },
    scores,
    topVideos: topSample,
    recent: recentSample,
  };

  const system =
    "You are a senior YouTube growth strategist. Analyze the provided channel snapshot and return STRICT JSON only, no prose, no markdown fences. Diagnose real issues from the data (weak hooks, low CTR signals, thumbnail issues, SEO gaps, inconsistent uploads) and give concrete, personalized actions. Titles/topics must reflect the channel niche implied by the sample videos.";

  const prompt = `Return JSON with this exact shape:
{
  "issues": [ { "key": "weak_hook|low_retention|low_ctr|bad_thumbnail|poor_seo|inconsistent_uploads|weak_titles|weak_descriptions|low_engagement", "title": string, "severity": "low|medium|high", "priority": 1-10, "impact": string, "explanation": string, "actions": string[3-5] } ],
  "plan": {
    "summary": string,
    "thirtyDayPlan": [ { "week": 1|2|3|4, "focus": string, "tasks": string[3-5] } ],
    "weeklySchedule": [ { "day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun", "slotUTC": "HH:MM", "format": "Short"|"Long"|"Live", "topic": string } ],
    "contentCalendar": [ { "date": "YYYY-MM-DD", "title": string, "format": "Short"|"Long", "hook": string } ],
    "trendingTopics": string[6-10],
    "videoIdeas": [ { "title": string, "angle": string, "format": "Short"|"Long" } ],
    "thumbnailSuggestions": string[5-8],
    "seoImprovements": string[5-8],
    "scriptRecommendations": string[5-8]
  }
}
Provide at least 6 issues (only those supported by the data), 4 weeks in thirtyDayPlan, 5-7 weeklySchedule rows, 8-12 contentCalendar rows for the next 14 days starting today, and 8-12 videoIdeas.

CHANNEL DATA:
${JSON.stringify(context, null, 2)}`;

  const text = await runAiText(system, prompt);
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: { issues: Issue[]; plan: GrowthPlan };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to salvage first JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  parsed.issues = (parsed.issues ?? []).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return parsed;
}

// ------------------------- Public server fn -------------------------

export const analyzeChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => z.object({ query: z.string().min(2).max(200) }).parse(data))
  .handler(async ({ data }): Promise<AnalyzerReport> => {
    const channelId = await resolveChannelId(data.query);
    const channel = await fetchChannel(channelId);
    if (!channel.uploadsPlaylistId) throw new Error("Channel has no uploads playlist.");
    const ids = await fetchRecentVideoIds(channel.uploadsPlaylistId, 50);
    const videos = await fetchVideos(ids);
    const metrics = computeMetrics(channel, videos);
    const scores = computeScores(channel, metrics);
    const { issues, plan } = await aiInsights(channel, metrics, scores);
    return {
      channel,
      metrics,
      scores,
      issues,
      plan,
      disclaimer:
        "Public YouTube Data API is used for metrics. Watch time, retention, CTR, revenue and demographics require channel-owner OAuth (YouTube Analytics API) and are AI-estimated from public signals here.",
    };
  });

/** Owner-only analysis: uses the channel connected through Google OAuth. */
export const analyzeMyChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyzerReport> => {
    const { getConnectedChannelId } = await import("./youtube-oauth.server");
    const channelId = await getConnectedChannelId(context.userId);
    const channel = await fetchChannel(channelId);
    if (!channel.uploadsPlaylistId) throw new Error("Channel has no uploads playlist.");
    const ids = await fetchRecentVideoIds(channel.uploadsPlaylistId, 50);
    const videos = await fetchVideos(ids);
    const metrics = computeMetrics(channel, videos);
    const scores = computeScores(channel, metrics);
    const { issues, plan } = await aiInsights(channel, metrics, scores);
    return {
      channel,
      metrics,
      scores,
      issues,
      plan,
      disclaimer:
        "Analysis of your connected channel. Watch time, retention, CTR and revenue estimates are AI-derived from available signals.",
    };
  });
