import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/build/")({
  head: () => ({
    meta: [
      { title: "Build Your App & Website — Smart GPT" },
      {
        name: "description",
        content: "Choose Create Web to build and publish a website, or Create App to build an app experience.",
      },
      { property: "og:title", content: "Build Your App & Website — Smart GPT" },
      { property: "og:description", content: "Create Web or Create App with Smart GPT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildHome,
});

function BuildHome() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Build Your App &amp; Website</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose what you want to create.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/build/web"
          className="group rounded-2xl border border-border/60 bg-card/40 p-6 transition-colors hover:border-primary/50 hover:bg-card/70"
        >
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Create Web</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Describe a website, generate it, preview it and publish it on a public link that opens
            in any standard browser.
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open builder <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          to="/build/app"
          className="group rounded-2xl border border-border/60 bg-card/40 p-6 transition-colors hover:border-primary/50 hover:bg-card/70"
        >
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Create App</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Describe an app, generate a working mobile-style app shell with navigation, then publish
            or install it from the browser.
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open builder <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
