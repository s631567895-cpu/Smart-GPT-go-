// Server-only helpers for per-user YouTube OAuth (Google OAuth 2.0).
// Never import this from a browser bundle.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export type GoogleCreds = { clientId: string; clientSecret: string };

/**
 * Reads the Google OAuth client from project secrets. Accepts either
 * YOUTUBE_OAUTH_CLIENT_ID + YOUTUBE_OAUTH_CLIENT_SECRET, or a single
 * `YouTubeoauth` secret holding the downloaded client_secret JSON
 * ({"web":{"client_id":"...","client_secret":"..."}}) or "id:secret".
 */
export function googleCreds(): GoogleCreds {
  const id = process.env["YOUTUBE_OAUTH_CLIENT_ID"];
  const secret = process.env["YOUTUBE_OAUTH_CLIENT_SECRET"];
  if (id && secret) return { clientId: id, clientSecret: secret };

  const raw = process.env["YouTubeoauth"] ?? process.env["YOUTUBEOAUTH"] ?? "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, any>;
      const node = parsed.web ?? parsed.installed ?? parsed;
      if (node?.client_id && node?.client_secret) {
        return { clientId: String(node.client_id), clientSecret: String(node.client_secret) };
      }
    } catch {
      /* fall through */
    }
  }
  const parts = trimmed.split(/[|:\s]+/).filter(Boolean);
  if (parts.length === 2 && parts[0].includes("apps.googleusercontent.com")) {
    return { clientId: parts[0], clientSecret: parts[1] };
  }
  throw new Error(
    "Google OAuth client is not configured. Add YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET in project secrets (or store the client_secret JSON in the YouTubeoauth secret).",
  );
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = googleCreds();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token error (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
  };
}

export async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = googleCreds();
  return tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleCreds();
  const t = await tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  return t.access_token;
}

export type StoredConnection = {
  channel_id: string;
  channel_title: string;
  channel_thumbnail: string | null;
  refresh_token: string;
  created_at: string;
};

export async function getStoredConnection(userId: string): Promise<StoredConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("youtube_connections")
    .select("channel_id, channel_title, channel_thumbnail, refresh_token, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredConnection | null) ?? null;
}

export async function saveConnection(
  userId: string,
  row: {
    channel_id: string;
    channel_title: string;
    channel_thumbnail: string | null;
    refresh_token: string;
    scope?: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("youtube_connections")
    .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function removeConnection(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("youtube_connections").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Fetch the signed-in owner's channel using an OAuth access token. */
export async function fetchMyChannel(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("mine", "true");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const item = json.items?.[0];
  if (!item) throw new Error("No YouTube channel found on this Google account.");
  return {
    id: item.id as string,
    title: (item.snippet?.title ?? "") as string,
    thumbnail: (item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null) as
      | string
      | null,
  };
}

/** Resolve the connected channel id for a user, refreshing the token as needed. */
export async function getConnectedChannelId(userId: string): Promise<string> {
  const conn = await getStoredConnection(userId);
  if (!conn) throw new Error("YouTube channel is not connected.");
  try {
    const accessToken = await refreshAccessToken(conn.refresh_token);
    const me = await fetchMyChannel(accessToken);
    return me.id;
  } catch {
    return conn.channel_id;
  }
}
