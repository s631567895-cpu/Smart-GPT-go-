import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/analyzer")({
  head: () => ({
    meta: [
      { title: "YouTube Analyzer — Smart GPT" },
      { name: "description", content: "This feature is private." },
      { property: "og:title", content: "YouTube Analyzer — Smart GPT" },
      { property: "og:description", content: "This feature is private." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: AnalyzerPage,
});

function AnalyzerPage() {
  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-3xl border border-border/60 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-5 font-display text-xl font-semibold">This feature is private.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Yeh feature abhi sabke liye available nahi hai.
          </p>
          <Link
            to="/chat"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Smart Chat
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
