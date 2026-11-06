import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MessageSquare, Layers, Youtube, WifiOff } from "lucide-react";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Get Started — Smart GPT" },
      {
        name: "description",
        content: "Choose Smart Chat for AI conversation, or build and publish your own website or app.",
      },
      { property: "og:title", content: "Get Started — Smart GPT" },
      {
        property: "og:description",
        content: "Two ways to start: Smart Chat or Build Your App & Website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetStarted,
});

function GetStarted() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <h1 className="mt-10 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          What would you like to do?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Pick one to continue.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Choice
            to="/chat"
            icon={MessageSquare}
            title="Smart Chat"
            desc="Talk with AI. Ask questions, plan, write and learn in a modern chat interface."
          />
          <Choice
            to="/build"
            icon={Layers}
            title="Build Your App & Website"
            desc="Describe what you want and generate a real website or app you can publish."
          />
          <Choice
            to="/analyzer"
            icon={Youtube}
            title="YouTube Analyzer"
            desc="Sign in, connect your channel and get AI insights on health, growth, SEO and a 30-day plan."
          />
          <Choice
            to="/offline"
            icon={WifiOff}
            title="Offline AI"
            desc="Download Smart GPT's own AI once and keep chatting even without internet."
          />
        </div>
      </div>
    </div>
  );
}

function Choice({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: "/chat" | "/build" | "/analyzer" | "/offline";
  icon: typeof MessageSquare;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border/60 bg-card/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-card/70 hover:shadow-glow"
    >
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Continue <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
