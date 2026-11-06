import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, CloudDownload, Wifi, WifiOff, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildIndex, answer } from "@/lib/offline-engine";
import { resolveContextualQuery } from "@/lib/context-memory";
import type { OfflineDoc } from "@/lib/offline.functions";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Offline AI — Smart GPT" },
      { name: "description", content: "Chat with Smart GPT's own AI even without internet. Download once, use anywhere." },
      { property: "og:title", content: "Offline AI — Smart GPT" },
      { property: "og:description", content: "Smart GPT's own AI that works online and offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfflinePage,
});

const KEY = "sg-offline-pack";
const NOT_FOUND = "Yeh jaankari abhi mujhe sikhayi nahi gayi hai. 🙏";
type Msg = { role: "user" | "ai"; text: string; meta?: string };
type Pack = { docs: OfflineDoc[]; updatedAt: string };

function OfflinePage() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPack(JSON.parse(raw));
    } catch { /* ignore */ }
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const inFrame = window.self !== window.top;
    if ("serviceWorker" in navigator && !inFrame && !location.hostname.includes("id-preview")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (navigator.onLine) void sync();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function sync() {
    setSyncing(true);
    setNote("");
    const { data, error } = await supabase.from("offline_packs").select("docs, updated_at").eq("id", "main").maybeSingle();
    setSyncing(false);
    if (error) return setNote("Update nahi ho paya. Saved copy use ho rahi hai.");
    if (!data) return setNote("Owner ne abhi Offline AI publish nahi kiya hai.");
    const p: Pack = { docs: (data.docs as unknown as OfflineDoc[]) ?? [], updatedAt: data.updated_at };
    localStorage.setItem(KEY, JSON.stringify(p));
    setPack(p);
  }

  const index = useMemo(() => (pack ? buildIndex(pack.docs) : null), [pack]);

  function send(q?: string) {
    const question = (q ?? text).trim();
    if (!question) return;
    setText("");
    // Context memory: resolve "isse aur batao"-type questions against the recent chat.
    const history = msgs.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
    const { resolved, usedHistory } = resolveContextualQuery(question, history);
    const r = index
      ? answer(index, resolved, NOT_FOUND)
      : { text: "Pehle internet se ek baar AI download karein.", confidence: 0, heading: null as string | null };
    const ctx = usedHistory && resolved !== question ? " · context samjha" : "";
    setMsgs((m) => [
      ...m,
      { role: "user", text: question },
      { role: "ai", text: r.text, meta: r.confidence ? `${r.heading ? r.heading + " · " : ""}${r.confidence}% match${ctx}` : undefined },
    ]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${online ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-4">
        <div className="py-6 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <Brain className="h-5 w-5" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Offline AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ek baar download karein — phir bina internet bhi chat karein.</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>{pack ? `${pack.docs.length} topics saved on this device` : "Not downloaded yet"}</span>
            {online && (
              <button onClick={() => void sync()} disabled={syncing} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:text-foreground disabled:opacity-50">
                <CloudDownload className="h-3.5 w-3.5" /> {syncing ? "Updating…" : "Update"}
              </button>
            )}
          </div>
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {msgs.length === 0 && (
            <p className="pt-6 text-center text-sm text-muted-foreground">Kuch bhi poochiye jo is AI ko sikhaya gaya hai.</p>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                {m.text}
                {m.meta && <div className="mt-1.5 text-[11px] text-muted-foreground">{m.meta}</div>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="sticky bottom-3 mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-card"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Apna sawal likhiye…"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button type="submit" aria-label="Send" disabled={!text.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </main>
    </div>
  );
}
