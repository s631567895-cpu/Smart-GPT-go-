import { AppShell } from "./app-shell";

export function ToolShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </AppShell>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-border/70 p-6 md:p-8 ${className}`}
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}
