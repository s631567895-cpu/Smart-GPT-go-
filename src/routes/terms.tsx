import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, AlertTriangle, RefreshCw, UserCheck } from "lucide-react";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Smart GPT" },
      { name: "description", content: "The terms that govern your use of Smart GPT." },
      { property: "og:title", content: "Terms of Use — Smart GPT" },
      { property: "og:description", content: "The terms that govern your use of Smart GPT." },
    ],
  }),
  component: TermsPage,
});

const TERMS = [
  { icon: AlertTriangle, title: "No illegal use", desc: "Don't use Smart GPT for anything illegal — including hate speech, harassment, fraud, malware, copyright infringement, or generating content involving minors." },
  { icon: ScrollText, title: "Review generated content", desc: "AI can make mistakes. Always review generated text, scripts, facts and images before publishing or sharing publicly." },
  { icon: RefreshCw, title: "Features may change", desc: "Smart GPT may add, change or remove features at any time as we improve the platform." },
  { icon: UserCheck, title: "Your responsibility", desc: "You are responsible for how you use generated content — including any claims, advice or media you publish based on it." },
];

function TermsPage() {
  return (
    <InfoPage eyebrow="Legal" title="Terms of Use" subtitle="By using Smart GPT you agree to these terms. Please read them.">
      <p className="mb-8 text-sm text-muted-foreground">Last updated: June 2026</p>

      <div className="space-y-4">
        {TERMS.map((t, i) => (
          <GlowCard key={t.title}>
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold">{i + 1}. {t.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      <GlowCard className="mt-8">
        <h3 className="font-display text-lg font-semibold">Disclaimer</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Smart GPT is provided "as is" without warranties of any kind. We are not liable for outcomes arising from your use of generated content. Lessons, scripts and chat responses are for educational and creative purposes — not professional, legal, medical or financial advice.
        </p>
      </GlowCard>
    </InfoPage>
  );
}
