import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Smart GPT" },
      { name: "description", content: "Frequently asked questions about Smart GPT — pricing, features, data, languages." },
      { property: "og:title", content: "Smart GPT — FAQ" },
      { property: "og:description", content: "Answers to the most common questions." },
    ],
  }),
  component: FAQPage,
});

const FAQS = [
  { q: "Is Smart GPT free?", a: "Yes — Smart GPT is free to use during our launch. You only need a Google or email account to sign in. We may introduce optional premium features later, but the core platform stays free." },
  { q: "How does Smart Chat work?", a: "Smart Chat gives you 5 specialized AI assistants — Business, Study, Language, Content and Productivity. Pick a category, ask anything in Hindi or English, and the AI responds with context-aware advice. Your chats are saved to your account so you can come back." },
  { q: "Can I generate YouTube scripts?", a: "Absolutely. The YouTube tool generates viral Hinglish Shorts scripts, titles, hooks, hashtags and thumbnail ideas. You can also paste a YouTube URL and Smart GPT will create a similar original script for you." },
  { q: "Can I learn languages here?", a: "Yes. We support English, Hindi, Spanish, French, German, Japanese and Korean. Pick a language and topic — vocab, grammar, speaking, daily phrases — and get a 5-minute AI-generated lesson. You can also use Language Chat for conversation practice." },
  { q: "Is my data secure?", a: "Yes. All traffic is encrypted (HTTPS), authentication uses industry-standard tokens, and your saved chats are protected by row-level security so only you can access them. We never sell personal data. Read our Privacy Policy for full details." },
  { q: "Can I upload images?", a: "Image upload in Smart Chat is on the roadmap — you'll be able to share screenshots and photos for the AI to analyse. For now, you can generate brand-new images using the AI Image Generator." },
];

function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <InfoPage eyebrow="Help" title="Frequently Asked Questions" subtitle="Quick answers to what people ask us most.">
      <div className="space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <GlowCard key={item.q} className="!p-0">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <HelpCircle className="h-5 w-5 shrink-0 text-primary" />
                  <span className="font-display text-base font-semibold sm:text-lg">{item.q}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border/40 px-5 pb-5 pt-4 text-sm text-muted-foreground sm:px-6">
                  {item.a}
                </div>
              )}
            </GlowCard>
          );
        })}
      </div>

      <GlowCard className="mt-8 text-center">
        <h3 className="font-display text-lg font-semibold">Didn't find your answer?</h3>
        <p className="mt-1 text-sm text-muted-foreground">We'd love to help — drop us a note.</p>
        <Link to="/contact" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: "var(--gradient-primary)" }}>
          Contact support
        </Link>
      </GlowCard>
    </InfoPage>
  );
}
