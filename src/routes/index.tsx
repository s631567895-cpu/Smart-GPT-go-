import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ArrowRight, MessageSquare, Brain, Layers, Youtube, WandSparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart GPT — AI Chat, Training Studio & App Builder" },
      {
        name: "description",
        content:
          "Smart GPT is a focused AI workspace: talk to Smart Chat, train your own AI in the Training Studio, and build and publish websites and apps.",
      },
      { property: "og:title", content: "Smart GPT — AI Chat, Training Studio & App Builder" },
      {
        property: "og:description",
        content: "One clean AI workspace for chat, your own trained AI and building web and app projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const MENU = [
  { to: "/chat", label: "Smart Chat" },
  { to: "/studio", label: "Training Studio" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

const HIGHLIGHTS = [
  {
    icon: MessageSquare,
    title: "Smart Chat",
    desc: "A fast, modern AI conversation with copy, reactions, sharing and read-aloud.",
  },
  {
    icon: Brain,
    title: "Training Studio",
    desc: "Train your own AI with your own data — knowledge, folders and 12 languages.",
  },
  {
    icon: Youtube,
    title: "YouTube Analyzer",
    desc: "Channel insights and content ideas powered by your own YouTube data.",
  },
  {
    icon: Layers,
    title: "Build & publish",
    desc: "Describe a website or an app, generate it, then publish it on a public link.",
  },
];

const CHATBOT_ID = "nQukq7-SEYDq6970bO_Zs";

function Landing() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border/60 transition-colors hover:bg-accent"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link
            to="/auth"
            className="rounded-lg border border-border/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Login / Sign up
          </Link>
        </div>

        {open && (
          <nav className="border-t border-border/60 bg-background/95">
            <div className="mx-auto flex max-w-6xl flex-col p-3 sm:px-6">
              {MENU.map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pb-8 pt-14 text-center sm:px-6 sm:pb-10 sm:pt-20">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Smart GPT</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            A focused AI workspace
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Chat with AI, train your own AI with your own data, and create and publish your own
            website or app — all in one clean place.
          </p>
          <div className="mt-8">
            <Link
              to="/get-started"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="mb-5 text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
              <WandSparkles className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold sm:text-2xl">Try Smart GPT live</h2>
            <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
              Ask one or two questions right here. No login required.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Example questions">
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                Write a YouTube hook
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                Explain quantum physics in Hindi
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <iframe
              title="Try the Smart GPT assistant"
              src={`https://www.chatbase.co/chatbot-iframe/${CHATBOT_ID}`}
              className="h-[370px] w-full bg-card"
              allow="microphone"
            />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-28 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="rounded-2xl border border-border/60 bg-card/40 p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-glow">
                <h.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-base font-semibold">{h.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{h.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Smart GPT
      </footer>
    </div>
  );
}
