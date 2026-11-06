import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function returnUrl(): string {
  const request = getRequest();
  if (!request) throw new Error("OAuth must start from an app request.");
  const url = new URL(request.url);
  const forwarded = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  const origin = forwarded ? `https://${forwarded}` : url.origin;
  return new URL("/oauth/youtube/return", origin).toString();
}

export const getYouTubeConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStoredConnection } = await import("./youtube-oauth.server");
    const conn = await getStoredConnection(context.userId);
    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      channel: {
        id: conn.channel_id,
        title: conn.channel_title,
        thumbnail: conn.channel_thumbnail,
        connectedAt: conn.created_at,
      },
    };
  });

export const startYouTubeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { buildAuthUrl } = await import("./youtube-oauth.server");
    const redirectUri = returnUrl();
    return { authorizationUrl: buildAuthUrl(redirectUri, crypto.randomUUID()), redirectUri };
  });

export const completeYouTubeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeCode, fetchMyChannel, saveConnection, getStoredConnection } = await import(
      "./youtube-oauth.server"
    );
    const tokens = await exchangeCode(data.code, returnUrl());
    const channel = await fetchMyChannel(tokens.access_token);
    const existing = await getStoredConnection(context.userId);
    const refresh = tokens.refresh_token ?? existing?.refresh_token;
    if (!refresh) throw new Error("Google did not return a refresh token. Try connecting again.");
    await saveConnection(context.userId, {
      channel_id: channel.id,
      channel_title: channel.title,
      channel_thumbnail: channel.thumbnail,
      refresh_token: refresh,
      scope: tokens.scope ?? null,
    });
    return { channel };
  });

export const disconnectYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { removeConnection } = await import("./youtube-oauth.server");
    await removeConnection(context.userId);
    return { ok: true };
  });
