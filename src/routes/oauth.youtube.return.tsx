import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/youtube/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connecting YouTube — Smart GPT" },
      { name: "description", content: "Finishing your YouTube channel connection." },
    ],
  }),
  component: YouTubeReturn,
});

function YouTubeReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const send = (type: "youtubeOAuthComplete" | "youtubeOAuthFailed", payload?: string) => {
      window.opener?.postMessage({ type, code: payload ?? null }, window.location.origin);
      window.close();
    };
    if (error || !code) {
      setMessage(error ? `Connection cancelled: ${error}` : "No authorization code received.");
      send("youtubeOAuthFailed");
      return;
    }
    send("youtubeOAuthComplete", code);
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
