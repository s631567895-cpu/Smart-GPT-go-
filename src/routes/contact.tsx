import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Clock, Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Smart GPT" },
      { name: "description", content: "Reach the Smart GPT team — email support, web form, response times." },
      { property: "og:title", content: "Contact Smart GPT" },
      { property: "og:description", content: "Get in touch with the Smart GPT team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setName(""); setEmail(""); setMessage("");
      toast.success("Message received! We'll reply within 48 hours.");
    }, 700);
  }

  return (
    <InfoPage eyebrow="Get in touch" title="Contact Us" subtitle="Questions, partnerships or support — we'd love to hear from you.">
      <div className="grid gap-6 md:grid-cols-2">
        <GlowCard>
          <Mail className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-display text-lg font-semibold">Email support</h3>
          <p className="mt-1 text-sm text-muted-foreground">For account issues, partnerships or press.</p>
          <a href="mailto:support@smartgrowth.app" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            support@smartgrowth.app
          </a>
        </GlowCard>

        <GlowCard>
          <Clock className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-display text-lg font-semibold">Response time</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We aim to respond within <strong className="text-foreground">24–48 hours</strong> on business days. Urgent issues are prioritized.
          </p>
        </GlowCard>
      </div>

      <GlowCard className="mt-6">
        <h2 className="font-display text-xl font-bold">Send us a message</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use this form for any general enquiry. For feedback or feature requests, head to the <Link to="/feedback" className="text-primary hover:underline">feedback page</Link>.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
            </Field>
          </div>
          <Field label="Message">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5}
              className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          </Field>
          <button disabled={sending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send message
          </button>
        </form>
      </GlowCard>

      <Link to="/feedback" className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <MessageSquare className="h-4 w-4" /> Or share product feedback →
      </Link>
    </InfoPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
