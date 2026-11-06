import { createFileRoute } from "@tanstack/react-router";
import { Video, Mic, Film, Presentation, Globe, Smartphone, Rocket } from "lucide-react";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — Smart GPT" },
      { name: "description", content: "What's coming next on Smart GPT: AI video, voice, slides, website builder and mobile app." },
      { property: "og:title", content: "Smart GPT Roadmap" },
      { property: "og:description", content: "Coming soon: AI Video, Voice, Slides, Website Builder & Mobile App." },
    ],
  }),
  component: RoadmapPage,
});

const ITEMS = [
  { icon: Video, title: "AI Video Generator", desc: "Text-to-video — short clips for Reels, Shorts and TikTok in Hindi & English." },
  { icon: Mic, title: "AI Voice Generator", desc: "Studio-quality voiceovers in multiple Indian and global languages." },
  { icon: Film, title: "Auto Video Editing", desc: "Upload raw footage, get a viral-ready edit with cuts, captions and music." },
  { icon: Presentation, title: "AI Slides Generator", desc: "Type a topic — get a beautiful, branded presentation in seconds." },
  { icon: Globe, title: "AI Website Builder", desc: "Describe your business — Smart GPT ships a live website for you." },
  { icon: Smartphone, title: "Smart GPT Mobile App", desc: "Native iOS & Android — learn and create on the go." },
];

function RoadmapPage() {
  return (
    <InfoPage eyebrow="Coming soon" title="Feature Roadmap" subtitle="The next wave of AI tools we're building. Vote on what you want most via the feedback page.">
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
        <Rocket className="h-5 w-5 shrink-0 text-primary" />
        <span>These features are in active development. Sign in to your account to get notified when each one ships.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <GlowCard key={it.title}>
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--gradient-primary)" }}>
                <it.icon className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Coming soon
                </div>
                <h3 className="font-display text-lg font-semibold">{it.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>
    </InfoPage>
  );
}
