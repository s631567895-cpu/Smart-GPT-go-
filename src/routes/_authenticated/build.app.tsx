import { createFileRoute } from "@tanstack/react-router";
import { SiteBuilder } from "@/components/site-builder";

export const Route = createFileRoute("/_authenticated/build/app")({
  head: () => ({
    meta: [
      { title: "Create App — Smart GPT" },
      { name: "description", content: "Describe an app, generate a working app shell, preview it and publish it." },
      { property: "og:title", content: "Create App — Smart GPT" },
      { property: "og:description", content: "Generate and publish a real app experience from a description." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SiteBuilder kind="app" />,
});
