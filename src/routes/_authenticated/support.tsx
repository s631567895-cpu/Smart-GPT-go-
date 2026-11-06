import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getChatbaseToken } from "@/lib/chatbase.functions";

const CHATBOT_ID = "nQukq7-SEYDq6970bO_Zs";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support Assistant | Smart GPT" },
      {
        name: "description",
        content:
          "Chat with the Smart GPT support assistant for instant help with tools, credits and your account.",
      },
      { property: "og:title", content: "Support Assistant | Smart GPT" },
      {
        property: "og:description",
        content: "Instant answers about Smart GPT tools, credits and your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const fetchToken = useServerFn(getChatbaseToken);
  const { data } = useQuery({
    queryKey: ["chatbase-token"],
    queryFn: () => fetchToken({}),
    refetchInterval: 50 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const token = data?.token;
    if (!token) return;
    const w = window as unknown as { chatbase?: (a: string, b: unknown) => void };
    w.chatbase?.("identify", { token });
  }, [data?.token]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Support Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask anything about Smart GPT — tools, credits, billing or your account.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <iframe
          title="Smart GPT support assistant"
          src={`https://www.chatbase.co/chatbot-iframe/${CHATBOT_ID}`}
          className="w-full"
          style={{ height: "70vh", minHeight: 700 }}
          allow="microphone"
        />
      </div>

      {data && !data.configured && (
        <p className="mt-3 text-xs text-muted-foreground">
          Personalised answers turn on once the assistant&apos;s identity key is added.
        </p>
      )}
    </div>
  );
}
