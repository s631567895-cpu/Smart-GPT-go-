import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { MessageSquare, Flame, ImageIcon, Bookmark, Sparkles, Award } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { listThreads } from "@/lib/chat-data.functions";
import { getDashboardStats, touchStreak } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Smart GPT" }] }),
  component: DashboardPage,
});

const BADGES: Record<string, { label: string; emoji: string }> = {
  first_chat: { label: "First Chat", emoji: "💬" },
  first_image: { label: "First Image", emoji: "🎨" },
  streak_3: { label: "3-day Streak", emoji: "🔥" },
  streak_7: { label: "7-day Streak", emoji: "⚡" },
  saver: { label: "Vault Collector", emoji: "📚" },
};

function DashboardPage() {
  const statsFn = useServerFn(getDashboardStats);
  const listFn = useServerFn(listThreads);
  const touchFn = useServerFn(touchStreak);

  useEffect(() => { touchFn().catch(() => {}); }, [touchFn]);

  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => listFn() });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Creator Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Your activity, streaks, and achievements.</p>

        <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Stat icon={MessageSquare} label="Chats" value={stats.data?.chats ?? 0} loading={stats.isLoading} />
          <Stat icon={ImageIcon} label="Images" value={stats.data?.images ?? 0} loading={stats.isLoading} />
          <Stat icon={Bookmark} label="Saved" value={stats.data?.saved ?? 0} loading={stats.isLoading} />
          <Stat icon={Flame} label="Streak" value={stats.data?.streak ?? 0} loading={stats.isLoading} />
        </div>

        <div className="mt-10">
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-xl font-semibold">
            <Award className="h-5 w-5 text-primary" /> Achievements
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BADGES).map(([code, b]) => {
              const earned = stats.data?.badges.includes(code);
              return (
                <div key={code} className={`glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${earned ? "" : "opacity-40"}`}>
                  <span className="text-lg">{b.emoji}</span>
                  <span>{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Recent chats</h2>
            <Link to="/chat" search={{}} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">+ New chat</Link>
          </div>
          {threads.isLoading ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (threads.data?.threads.length ?? 0) === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" /> No chats yet.
            </div>
          ) : (
            <div className="grid gap-2">
              {threads.data!.threads.slice(0, 8).map((t) => (
                <Link key={t.id} to="/chat" search={{ thread: t.id }} className="glass flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-white/10">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-primary">{t.category}</div>
                    <div className="truncate text-sm">{t.title}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, loading }: { icon: typeof Sparkles; label: string; value: number; loading: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold sm:text-3xl">{loading ? "…" : value}</div>
    </div>
  );
}
