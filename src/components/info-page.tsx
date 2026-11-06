import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

export function InfoPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-border/60" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          {eyebrow && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-primary backdrop-blur-md">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient">{title}</span>
          </h1>
          {subtitle && <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">{children}</div>
    </AppShell>
  );
}

export function GlowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/60 p-6 sm:p-8 ${className}`}
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl" style={{ background: "var(--gradient-primary)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}
