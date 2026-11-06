import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Use" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/feedback", label: "Send Feedback" },
  { to: "/roadmap", label: "Roadmap" },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/60" style={{ background: "oklch(0.13 0.03 265 / 0.6)" }}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold">
                <span className="text-gradient">Smart GPT</span>
              </div>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                AI-powered learning & creator platform. Learn business, languages, productivity and content creation — all in one place.
              </p>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-1 sm:text-right">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="text-muted-foreground transition-colors hover:text-primary">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Smart GPT. All rights reserved.</span>
          <span>Made with ✨ for learners, creators & entrepreneurs.</span>
        </div>
      </div>
    </footer>
  );
}
