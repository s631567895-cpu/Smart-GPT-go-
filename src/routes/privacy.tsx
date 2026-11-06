import { createFileRoute } from "@tanstack/react-router";
import { Shield, Lock, Eye, Database, BarChart3, FileCheck } from "lucide-react";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Smart GPT" },
      { name: "description", content: "How Smart GPT handles your chats, uploaded files, and personal data." },
      { property: "og:title", content: "Privacy Policy — Smart GPT" },
      { property: "og:description", content: "How we handle your data at Smart GPT." },
    ],
  }),
  component: PrivacyPage,
});

const POINTS = [
  { icon: Eye, title: "Chats stay private", desc: "Your chats are used only to generate responses for you. We do not share them with third parties for advertising." },
  { icon: Lock, title: "We never sell your data", desc: "Smart GPT does not sell personal data to anyone — full stop." },
  { icon: FileCheck, title: "Uploaded files & images", desc: "Files and images you upload are processed only for the task you requested and are not used to train external models." },
  { icon: BarChart3, title: "Analytics", desc: "We may use anonymous analytics (usage patterns, page views) to improve the platform — never tied to your identity for marketing." },
  { icon: Database, title: "Data storage", desc: "Account data is stored securely in our backend. You can delete your account at any time by contacting us." },
  { icon: Shield, title: "Security", desc: "All traffic is encrypted in transit (HTTPS). Authentication uses industry-standard tokens with strict row-level security on stored data." },
];

function PrivacyPage() {
  return (
    <InfoPage eyebrow="Legal" title="Privacy Policy" subtitle="This page is maintained by Smart GPT to explain how we collect, use and protect your information.">
      <p className="mb-8 text-sm text-muted-foreground">Last updated: June 2026</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {POINTS.map((p) => (
          <GlowCard key={p.title}>
            <div className="flex items-start gap-3">
              <p.icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      <GlowCard className="mt-8">
        <h3 className="font-display text-lg font-semibold">Your rights</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          You can request a copy of your data or ask us to delete your account at any time. Reach us through the <a href="/contact" className="text-primary hover:underline">contact page</a>. We aim to respond within 7 days.
        </p>
      </GlowCard>
    </InfoPage>
  );
}
