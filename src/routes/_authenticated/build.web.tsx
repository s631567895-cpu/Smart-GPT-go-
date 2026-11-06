import { createFileRoute } from "@tanstack/react-router";
import { SiteBuilder } from "@/components/site-builder";

export const Route = createFileRoute("/_authenticated/build/web")({
  head: () => ({
    meta: [
      { title: "Create Web — Smart GPT" },
      { name: "description", content: "Describe a website, generate it and publish it on a public link." },
      { property: "og:title", content: "Create Web — Smart GPT" },
      { property: "og:description", content: "Generate and publish a real website from a description." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SiteBuilder kind="web" />,
});
