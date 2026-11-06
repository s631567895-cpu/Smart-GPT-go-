import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/site/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const url = process.env["SUPABASE_URL"];
        if (!key || !url) return new Response("Not configured", { status: 500 });

        const supabase = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await supabase
          .from("sites")
          .select("html, published")
          .eq("slug", params.slug)
          .eq("published", true)
          .maybeSingle();

        if (error) return new Response("Unable to load this site", { status: 500 });
        if (!data?.html) {
          return new Response(
            "<!doctype html><meta charset='utf-8'><title>Not published</title><p style='font-family:system-ui;padding:40px'>This site is not published.</p>",
            { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }

        return new Response(data.html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
