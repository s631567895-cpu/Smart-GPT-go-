import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ads.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("google.com, pub-7190378129848568, DIRECT, f08c47fec0942fa0", {
          headers: {
            "Content-Type": "text/plain",
          },
        });
      },
    },
  },
});
