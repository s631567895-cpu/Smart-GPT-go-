import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Loader2, MessageSquare, Lightbulb, Bug } from "lucide-react";
import { toast } from "sonner";
import { InfoPage, GlowCard } from "@/components/info-page";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Send Feedback — Smart GPT" },
      { name: "description", content: "Share feedback, request features, or report a bug to the Smart GPT team." },
      { property: "og:title", content: "Send Feedback — Smart GPT" },
      { property: "og:description", content: "Help us make Smart GPT better." },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "", feature: "", bug: "" });
  const [sending, setSending] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Name, email and feedback message are required");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setForm({ name: "", email: "", message: "", feature: "", bug: "" });
      toast.success("Thank you! Your feedback has been received.");
    }, 700);
  }

  return (
    <InfoPage eyebrow="We listen" title="Send Feedback" subtitle="Tell us what's working, what's broken, and what you'd love to see next.">
      <GlowCard>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required>
              <input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
            </Field>
            <Field label="Email" required>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={200}
                className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
            </Field>
          </div>

          <Field label="Feedback message" icon={MessageSquare} required>
            <textarea value={form.message} onChange={(e) => update("message", e.target.value)} maxLength={2000} rows={4}
              placeholder="What do you love? What's confusing?"
              className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          </Field>

          <Field label="Feature request (optional)" icon={Lightbulb}>
            <textarea value={form.feature} onChange={(e) => update("feature", e.target.value)} maxLength={1000} rows={3}
              placeholder="A new tool, integration, language…"
              className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          </Field>

          <Field label="Bug report (optional)" icon={Bug}>
            <textarea value={form.bug} onChange={(e) => update("bug", e.target.value)} maxLength={1000} rows={3}
              placeholder="What went wrong? Steps to reproduce?"
              className="w-full resize-none rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30" />
          </Field>

          <button disabled={sending} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit feedback
          </button>
        </form>
      </GlowCard>
    </InfoPage>
  );
}

function Field({ label, children, required, icon: Icon }: { label: string; children: React.ReactNode; required?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}
