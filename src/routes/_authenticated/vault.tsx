import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, ImageIcon, MessageSquare, FileText, BookOpen, StickyNote, Lock } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { listSaved, deleteSaved } from "@/lib/profile.functions";

type Kind = "all" | "chat" | "script" | "image" | "lesson" | "note";

const TABS: { id: Kind; label: string; icon: typeof Lock }[] = [
  { id: "all", label: "All", icon: Lock },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "script", label: "Scripts", icon: FileText },
  { id: "chat", label: "Chats", icon: MessageSquare },
  { id: "lesson", label: "Lessons", icon: BookOpen },
  { id: "note", label: "Notes", icon: StickyNote },
];

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({ meta: [{ title: "Private Vault — Smart GPT" }] }),
  ssr: false,
  component: VaultPage,
});

function VaultPage() {
  const [tab, setTab] = useState<Kind>("all");
  const qc = useQueryClient();
  const listFn = useServerFn(listSaved);
  const delFn = useServerFn(deleteSaved);

  const q = useQuery({
    queryKey: ["vault", tab],
    queryFn: () => listFn({ data: tab === "all" ? {} : { kind: tab } }),
  });

  async function remove(id: string) {
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["vault"] });
    toast.success("Removed");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="inline-flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
          <Lock className="h-7 w-7 text-primary" /> Private Vault
        </h1>
        <p className="mt-2 text-muted-foreground">Your saved images, scripts, chats, lessons & notes — all in one place.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "border border-border bg-card/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {q.isLoading ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (q.data?.items.length ?? 0) === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Nothing here yet. Save items from Chat or Images to find them in your Vault.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {q.data!.items.map((item) => {
                const content = (item.content as Record<string, unknown>) ?? {};
                const imgs = Array.isArray(content.images) ? (content.images as string[]) : [];
                return (
                  <div key={item.id} className="glass rounded-2xl p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-primary">{item.kind}{item.category ? ` · ${item.category}` : ""}</div>
                        <div className="truncate text-sm font-semibold">{item.title}</div>
                      </div>
                      <button onClick={() => remove(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {imgs.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1">
                        {imgs.slice(0, 4).map((src, i) => (
                          <img key={i} src={src} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                        ))}
                      </div>
                    ) : typeof content.text === "string" ? (
                      <p className="line-clamp-4 text-xs text-muted-foreground">{content.text as string}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
