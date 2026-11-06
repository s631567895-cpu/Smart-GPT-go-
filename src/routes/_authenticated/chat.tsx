import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

/** Maps any chat failure to a calm, user-facing sentence (never a crash screen). */
function friendlyChatError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/429|rate.?limit|too many requests/i.test(msg)) return "System is busy, please try again in a minute.";
  if (/402|credit|quota/i.test(msg)) return "AI usage limit reached — please try again later.";
  if (/401|unauthor/i.test(msg)) return "Your session expired. Please sign in again.";
  if (/network|fetch|timeout|aborted/i.test(msg)) return "Network hiccup — check your connection and try again.";
  return "System is busy, please try again in a minute.";
}
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, Sparkles, User, Plus, Image as ImgIcon, FileText, X,
  Trash2, Copy, Share2, Pencil, Pin, RefreshCw, ChevronDown, Zap, BookOpen,
  ThumbsUp, ThumbsDown, Volume2, Save,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppShell } from "@/components/app-shell";
import { BrandThinking } from "@/components/brand-loader";
import { createThread, listThreads, deleteThread, getThreadMessages, saveMessages } from "@/lib/chat-data.functions";
import { saveItem } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";

const SEARCH = z.object({
  thread: z.string().uuid().optional(),
  category: z.enum(["general", "business", "study", "language", "content", "productivity"]).optional(),
});

type CatId = "general" | "business" | "study" | "language" | "content" | "productivity";

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (s) => SEARCH.parse(s),
  head: () => ({ meta: [{ title: "Smart Chat — Smart GPT" }] }),
  component: ChatPage,
});

function catTitle(c: string) {
  const m: Record<string, string> = {
    business: "Business chat", study: "Study chat", language: "Language chat",
    content: "Content chat", productivity: "Productivity chat", general: "New chat",
  };
  return m[c] ?? "New chat";
}

function ChatPage() {
  const { thread, category } = Route.useSearch();
  const navigate = useNavigate();
  const createFn = useServerFn(createThread);
  const listFn = useServerFn(listThreads);
  const deleteFn = useServerFn(deleteThread);
  const qc = useQueryClient();

  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => listFn() });

  const createMut = useMutation({
    mutationFn: (cat: CatId) => createFn({ data: { title: catTitle(cat), category: cat } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat", search: { thread: t.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create chat"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (thread) navigate({ to: "/chat", search: {} });
      toast.success("Chat deleted");
    },
  });

  // Open the chat screen instantly: resume the most recent thread (or the one
  // in the chosen category), otherwise create a fresh general chat.
  useEffect(() => {
    if (thread || !threadsQ.data || createMut.isPending) return;
    const pool = category
      ? threadsQ.data.threads.filter((t) => t.category === category)
      : threadsQ.data.threads;
    const existing = pool[0] ?? threadsQ.data.threads[0];
    if (existing) {
      navigate({ to: "/chat", search: { thread: existing.id }, replace: true });
    } else {
      createMut.mutate(category ?? "general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, thread, threadsQ.data]);

  if (!thread) {
    return (
      <AppShell>
        <div className="grid min-h-[70vh] place-items-center px-4">
          <BrandThinking />
        </div>
      </AppShell>
    );
  }

  const activeThread = threadsQ.data?.threads.find((t) => t.id === thread);
  const cat = (activeThread?.category as CatId) ?? "general";
  return (
    <ThreadView
      key={thread}
      threadId={thread}
      category={cat}
      threadTitle={activeThread?.title ?? "Chat"}
      onDelete={() => { if (confirm("Delete this chat?")) deleteMut.mutate(thread); }}
    />
  );
}

function ThreadView({ threadId, category, threadTitle, onDelete }: {
  threadId: string; category: string; threadTitle: string; onDelete: () => void;
}) {
  const getMessagesFn = useServerFn(getThreadMessages);
  const saveFn = useServerFn(saveMessages);
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => getMessagesFn({ data: { threadId } }),
  });

  if (historyQ.isLoading) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppShell>
    );
  }

  const initial: UIMessage[] = (historyQ.data?.messages ?? []).map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: (r.parts as unknown as UIMessage["parts"]) ?? [],
  }));

  return (
    <ChatStream
      threadId={threadId}
      category={category}
      threadTitle={threadTitle}
      initial={initial}
      onSaved={() => qc.invalidateQueries({ queryKey: ["threads"] })}
      saveFn={saveFn}
      onDelete={onDelete}
    />
  );
}

function ChatStream({
  threadId, category, threadTitle, initial, onSaved, saveFn, onDelete,
}: {
  threadId: string;
  category: string;
  threadTitle: string;
  initial: UIMessage[];
  onSaved: () => void;
  saveFn: ReturnType<typeof useServerFn<typeof saveMessages>>;
  onDelete: () => void;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Array<{ type: "file"; mediaType: string; url: string; filename: string }>>([]);
  const [mode, setMode] = useState<"short" | "detailed">(() => {
    if (typeof window === "undefined") return "short";
    return (localStorage.getItem("sg-mode") as "short" | "detailed") ?? "short";
  });
  const [pinned, setPinned] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(`sg-pinned-${threadId}`) ?? "{}"); } catch { return {}; }
  });
  const [autoFollow, setAutoFollow] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "up" | "down" | undefined>>({});
  const saveToVaultFn = useServerFn(saveItem);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem("sg-mode", mode); }, [mode]);
  useEffect(() => { localStorage.setItem(`sg-pinned-${threadId}`, JSON.stringify(pinned)); }, [pinned, threadId]);

  // One stable transport instance per thread/category — recreating it on every
  // render caused repeated request setup and unstable chat state.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ category, mode }),
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [category, mode],
  );

  const { messages, sendMessage, status, stop, error, setMessages, regenerate } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      toast.error(friendlyChatError(e));
    },
  });

  // Persist messages after each completion
  const lastSavedCountRef = useRef<number>(initial.length);
  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length === lastSavedCountRef.current) return;
    if (messages.length === 0) return;
    const payload = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      parts: m.parts as unknown as unknown[],
    }));
    const firstUser = messages.find((m) => m.role === "user");
    const titleHint = firstUser ? firstUser.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim().slice(0, 80) : undefined;
    saveFn({ data: { threadId, messages: payload, titleHint } })
      .then(() => { lastSavedCountRef.current = messages.length; onSaved(); })
      .catch(() => {});
  }, [status, messages, threadId, saveFn, onSaved]);

  // Smart auto-scroll: only follow if user hasn't manually scrolled away
  useEffect(() => {
    if (!autoFollow) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status, autoFollow]);

  // Detect user scroll → disable autoFollow; re-enable when back at bottom
  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoFollow(atBottom);
  }
  function onUserInteract() {
    // Immediately stop following on any touch / wheel / pointer down
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!atBottom) setAutoFollow(false);
  }

  function jumpToLatest() {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setAutoFollow(true);
  }

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (status === "ready") inputRef.current?.focus(); }, [status]);

  const busy = status === "submitted" || status === "streaming";

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} too large (max 10MB)`); continue; }
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      next.push({ type: "file", mediaType: file.type || "application/octet-stream", url, filename: file.name });
    }
    setAttachments(next);
  }

  function submit() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;
    const parts: UIMessage["parts"] = [];
    for (const a of attachments) parts.push(a as never);
    if (text) parts.push({ type: "text", text });
    sendMessage({ parts: parts as never });
    setInput("");
    setAttachments([]);
    setAutoFollow(true);
  }

  // Message actions
  const onCopy = useCallback((m: UIMessage) => {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }, []);

  const onShare = useCallback(async (m: UIMessage) => {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
    if (navigator.share) {
      try { await navigator.share({ text, title: "Smart GPT chat" }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  }, []);

  const onDeleteMsg = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setPinned((p) => { const n = { ...p }; delete n[id]; return n; });
    lastSavedCountRef.current = -1; // force re-save
    toast.success("Message deleted");
  }, [setMessages]);

  const onPin = useCallback((id: string) => {
    setPinned((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const onRegenerate = useCallback((id: string) => {
    // Drop this assistant message and everything after, then regenerate
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    setTimeout(() => regenerate(), 50);
  }, [setMessages, regenerate]);

  const onEdit = useCallback((id: string, newText: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const updated = { ...prev[idx], parts: prev[idx].parts.map((p) => p.type === "text" ? { ...p, text: newText } : p) };
      // Keep messages up to and including the edited one, drop everything after
      const kept = [...prev.slice(0, idx), updated];
      return kept;
    });
    setEditingId(null);
    setTimeout(() => regenerate(), 50);
  }, [setMessages, regenerate]);

  const onReact = useCallback((id: string, r: "up" | "down") => {
    setReactions((prev) => ({ ...prev, [id]: prev[id] === r ? undefined : r }));
    if (r === "down") toast.success("Thanks — feedback noted");
  }, []);

  const onReadAloud = useCallback((m: UIMessage) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Read aloud not supported on this device"); return;
    }
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  }, []);

  const onSaveToVault = useCallback(async (m: UIMessage) => {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
    if (!text) return;
    try {
      await saveToVaultFn({ data: {
        kind: m.role === "assistant" ? "chat" : "note",
        category, title: text.slice(0, 80),
        content: { text, role: m.role },
      } });
      toast.success("Saved to Vault");
    } catch { toast.error("Save failed"); }
  }, [saveToVaultFn, category]);

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-primary">{category}</div>
            <div className="truncate font-display text-lg font-semibold">{threadTitle}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ModeToggle mode={mode} setMode={setMode} />
            <button onClick={onDelete} className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:text-destructive" aria-label="Delete chat">
              <Trash2 className="h-4 w-4" />
            </button>
            <Link to="/chat" search={{}} className="hidden sm:inline-block rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">All chats</Link>
          </div>
        </div>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onTouchStart={onUserInteract}
          onWheel={onUserInteract}
          onMouseDown={onUserInteract}
          className="relative flex-1 space-y-5 overflow-y-auto py-6"
        >
          {messages.length === 0 && (
            <div className="grid place-items-center py-12 text-center text-muted-foreground">
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <p className="text-sm">Start the conversation. Type a message or attach an image/PDF.</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              pinned={!!pinned[m.id]}
              editing={editingId === m.id}
              reaction={reactions[m.id]}
              onStartEdit={() => setEditingId(m.id)}
              onCancelEdit={() => setEditingId(null)}
              onCopy={() => onCopy(m)}
              onShare={() => onShare(m)}
              onDelete={() => onDeleteMsg(m.id)}
              onPin={() => onPin(m.id)}
              onRegenerate={() => onRegenerate(m.id)}
              onEdit={(t) => onEdit(m.id, t)}
              onLike={() => onReact(m.id, "up")}
              onDislike={() => onReact(m.id, "down")}
              onReadAloud={() => onReadAloud(m)}
              onSaveVault={() => onSaveToVault(m)}
            />
          ))}
          {(status === "submitted" || status === "streaming") && (
            <div className="flex items-center">
              <BrandThinking />
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-medium">{friendlyChatError(error)}</div>
              <button
                type="button"
                onClick={() => regenerate()}
                className="mt-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {!autoFollow && messages.length > 0 && (
          <button
            onClick={jumpToLatest}
            className="pointer-events-auto fixed bottom-28 left-1/2 z-30 -translate-x-1/2 animate-fade-in rounded-full border border-border/60 bg-background/90 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronDown className="mr-1 inline h-3.5 w-3.5" /> Jump to latest
          </button>
        )}

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="border-t border-border/60 py-3">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-white/5 px-2 py-1 text-xs">
                  {a.mediaType.startsWith("image/") ? <ImgIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  <span className="max-w-[160px] truncate">{a.filename}</span>
                  <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf,.txt,.md,.doc,.docx" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/60 bg-white/5 text-muted-foreground transition-colors hover:text-foreground" aria-label="Attach">
              <Plus className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder={mode === "short" ? "Ask anything — short reply..." : "Ask anything — detailed reply..."}
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            />
            {busy ? (
              <button type="button" onClick={() => stop()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card" aria-label="Stop">
                <Loader2 className="h-4 w-4 animate-spin" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() && attachments.length === 0} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white transition-opacity disabled:opacity-40" style={{ background: "var(--gradient-primary)" }} aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function ModeToggle({ mode, setMode }: { mode: "short" | "detailed"; setMode: (m: "short" | "detailed") => void }) {
  return (
    <div className="flex items-center rounded-lg border border-border/60 bg-white/5 p-0.5 text-xs">
      <button
        onClick={() => setMode("short")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${mode === "short" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Zap className="h-3 w-3" /> Short
      </button>
      <button
        onClick={() => setMode("detailed")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${mode === "detailed" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <BookOpen className="h-3 w-3" /> Detailed
      </button>
    </div>
  );
}

function MessageRow({
  message, pinned, editing, reaction,
  onStartEdit, onCancelEdit, onCopy, onShare, onDelete, onPin, onRegenerate, onEdit,
  onLike, onDislike, onReadAloud, onSaveVault,
}: {
  message: UIMessage;
  pinned: boolean;
  editing: boolean;
  reaction: "up" | "down" | undefined;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCopy: () => void;
  onShare: () => void;
  onDelete: () => void;
  onPin: () => void;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
  onLike: () => void;
  onDislike: () => void;
  onReadAloud: () => void;
  onSaveVault: () => void;
}) {
  const isUser = message.role === "user";
  const [menuOpen, setMenuOpen] = useState(false);
  const [editText, setEditText] = useState(() =>
    message.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n"),
  );
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() {
    cancelPress();
    pressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }
  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="relative max-w-[85%] space-y-2">
        {pinned && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
            <Pin className="h-3 w-3" /> Pinned
          </div>
        )}
        {editing ? (
          <div className="rounded-2xl border border-primary/40 bg-white/5 p-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-sm outline-none"
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={onCancelEdit} className="rounded-md border border-border/60 px-2 py-1 text-xs">Cancel</button>
              <button onClick={() => onEdit(editText)} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Save & regenerate</button>
            </div>
          </div>
        ) : (
          <div
            onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={cancelPress}
            onMouseDown={(e) => { if (e.button === 0) startPress(); }}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
          >
            {message.parts.map((p, idx) => {
              if (p.type === "text") {
                if (isUser) {
                  return (
                    <div key={idx} className="whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                      {p.text}
                    </div>
                  );
                }
                return (
                  <div key={idx} className="group/msg relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onCopy(); }}
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover/msg:opacity-100 focus:opacity-100"
                      aria-label="Copy message"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <div className="prose prose-sm prose-invert max-w-none rounded-2xl border border-border/60 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-foreground prose-headings:font-display prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-primary prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-pre:bg-black/40">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown>
                    </div>
                  </div>
                );

              }
              if (p.type === "file") {
                const isImg = p.mediaType?.startsWith("image/");
                if (isImg) return <img key={idx} src={p.url} alt={p.filename ?? ""} className="max-h-64 rounded-xl border border-border/60" />;
                return (
                  <a key={idx} href={p.url} download={p.filename} className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/5 px-3 py-2 text-xs">
                    <FileText className="h-4 w-4" /> {p.filename}
                  </a>
                );
              }
              return null;
            })}
          </div>
        )}

        {!editing && !isUser && (
          <div className="flex flex-wrap items-center gap-1 pl-1 opacity-70 hover:opacity-100 transition-opacity">
            <QuickAction icon={ThumbsUp} label="Like" active={reaction === "up"} onClick={onLike} />
            <QuickAction icon={ThumbsDown} label="Dislike" active={reaction === "down"} onClick={onDislike} />
            <QuickAction icon={Copy} label="Copy" onClick={onCopy} />
            <QuickAction icon={Share2} label="Share" onClick={onShare} />
            <QuickAction icon={Volume2} label="Read aloud" onClick={onReadAloud} />
            <QuickAction icon={Save} label="Save" onClick={onSaveVault} />
            <QuickAction icon={RefreshCw} label="Regenerate" onClick={onRegenerate} />
          </div>
        )}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className={`absolute z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-xl ${isUser ? "right-0" : "left-0"}`}>
              <ActionItem icon={Copy} label="Copy" onClick={() => { onCopy(); setMenuOpen(false); }} />
              <ActionItem icon={Share2} label="Share" onClick={() => { onShare(); setMenuOpen(false); }} />
              {isUser && <ActionItem icon={Pencil} label="Edit" onClick={() => { onStartEdit(); setMenuOpen(false); }} />}
              {!isUser && <ActionItem icon={RefreshCw} label="Regenerate" onClick={() => { onRegenerate(); setMenuOpen(false); }} />}
              <ActionItem icon={Pin} label={pinned ? "Unpin" : "Pin"} onClick={() => { onPin(); setMenuOpen(false); }} />
              <ActionItem icon={Trash2} label="Delete" danger onClick={() => { onDelete(); setMenuOpen(false); }} />
            </div>
          </>
        )}
      </div>
      {isUser && (
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <User className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function ActionItem({ icon: Icon, label, onClick, danger = false }: {
  icon: typeof Copy; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 ${danger ? "text-destructive" : "text-foreground"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function QuickAction({ icon: Icon, label, active = false, onClick }: {
  icon: typeof Copy; label: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/60 hover:bg-white/5 hover:text-foreground ${active ? "border-primary/40 bg-primary/10 text-primary" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
