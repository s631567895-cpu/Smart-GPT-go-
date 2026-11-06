import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Shield, Search, Loader2, Mail, Ban, Trash2, ChevronLeft, User as UserIcon,
  MessageSquare, ImageIcon, Lock, Mic, Flame, Send,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  checkAdmin, adminListUsers, adminGetUser, adminSetBanned, adminDeleteUser,
  adminSendMessage, adminListMessages,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Control — Smart GPT" },
      { name: "description", content: "Owner control panel: view every Smart GPT user, inspect their activity and message them directly by email." },
      { property: "og:title", content: "Admin Control — Smart GPT" },
      { property: "og:description", content: "Owner-only control panel for managing Smart GPT users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const checkAdminFn = useServerFn(checkAdmin);
  const listUsersFn = useServerFn(adminListUsers);
  const getUserFn = useServerFn(adminGetUser);
  const setBannedFn = useServerFn(adminSetBanned);
  const deleteUserFn = useServerFn(adminDeleteUser);
  const sendMessageFn = useServerFn(adminSendMessage);
  const listMessagesFn = useServerFn(adminListMessages);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const gate = useQuery({ queryKey: ["admin-gate"], queryFn: () => checkAdminFn({}) });
  const isAdmin = gate.data?.isAdmin === true;

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersFn({ data: {} }),
    enabled: isAdmin,
  });

  const detail = useQuery({
    queryKey: ["admin-user", selected],
    queryFn: () => getUserFn({ data: { userId: selected! } }),
    enabled: isAdmin && !!selected,
  });

  const log = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => listMessagesFn({}),
    enabled: isAdmin,
  });

  const banMut = useMutation({
    mutationFn: (v: { userId: string; banned: boolean }) => setBannedFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.banned ? "User suspended" : "User restored");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", v.userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: (v: { userId: string; email: string; subject: string; body: string }) =>
      sendMessageFn({ data: v }),
    onSuccess: (r) => {
      if (r.status === "sent") toast.success("Email sent");
      else toast.warning(r.error ?? "Message saved but not delivered");
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.data?.users ?? [];
    if (!q) return list;
    return list.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q),
    );
  }, [users.data, search]);

  if (gate.isLoading) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="glass rounded-3xl p-8">
            <Shield className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-bold">Owner access only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This control panel is restricted to the platform owner account.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const active = detail.data;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: "var(--gradient-primary)" }}>
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Admin Control</h1>
            <p className="text-sm text-muted-foreground">
              {users.data?.total ?? 0} registered users
            </p>
          </div>
        </div>

        {!selected ? (
          <>
            <div className="glass mt-6 flex items-center gap-2 rounded-2xl px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {users.isLoading ? (
              <div className="grid py-16 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="mt-4 grid gap-3">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className="glass flex items-center gap-3 rounded-2xl p-4 text-left transition-transform hover:scale-[1.005]"
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={`${u.display_name ?? u.email} avatar`} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{u.display_name ?? "Unnamed"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      <div>Streak {u.streak_count}</div>
                      <div>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "never"}</div>
                    </div>
                    {u.banned && (
                      <span className="rounded-full bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive">
                        Suspended
                      </span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">No users found.</p>
                )}
              </div>
            )}

            <h2 className="mt-10 font-display text-lg font-bold">Sent messages</h2>
            <div className="mt-3 grid gap-2">
              {(log.data?.items ?? []).map((m: any) => (
                <div key={m.id} className="glass rounded-xl p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{m.subject}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{m.status}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.to_email}</div>
                </div>
              ))}
              {(log.data?.items ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No messages sent yet.</p>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <button
              onClick={() => setSelected(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Back to all users
            </button>

            {detail.isLoading || !active ? (
              <div className="grid py-16 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="glass rounded-3xl p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    {active.profile?.avatar_url ? (
                      <img src={active.profile.avatar_url} alt="User avatar" className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15">
                        <UserIcon className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-lg font-bold">
                        {active.profile?.display_name ?? "Unnamed"}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{active.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {active.created_at ? new Date(active.created_at).toLocaleDateString() : "—"} ·
                        {" "}Last sign-in {active.last_sign_in_at ? new Date(active.last_sign_in_at).toLocaleString() : "never"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => banMut.mutate({ userId: selected, banned: !active.profile?.banned })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm hover:bg-primary/10"
                      >
                        <Ban className="h-4 w-4" /> {active.profile?.banned ? "Unsuspend" : "Suspend"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Permanently delete this user and all their data?")) delMut.mutate(selected);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat icon={Flame} label="Day streak" value={active.profile?.streak_count ?? 0} />
                  <Stat icon={MessageSquare} label="Messages" value={active.messageCount} />
                  <Stat icon={ImageIcon} label="Images" value={active.images.length} />
                  <Stat icon={Lock} label="Saved" value={active.saved.length} />
                  <Stat icon={Mic} label="Voice days" value={active.voice.length} />
                </div>

                <div className="glass mt-4 rounded-3xl p-5">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold">
                    <Mail className="h-4 w-4 text-primary" /> Send email to this user
                  </h3>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={160}
                    placeholder="Subject"
                    className="mt-3 w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={5000}
                    rows={5}
                    placeholder="Write your message…"
                    className="mt-2 w-full resize-y rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    disabled={sendMut.isPending || !subject.trim() || !body.trim()}
                    onClick={() =>
                      sendMut.mutate({ userId: selected, email: active.email, subject, body })
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send to {active.email}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="glass rounded-3xl p-5">
                    <h3 className="font-display text-base font-bold">Recent chats</h3>
                    <div className="mt-3 grid gap-2">
                      {active.threads.map((t: any) => (
                        <div key={t.id} className="rounded-xl border border-border/50 px-3 py-2 text-sm">
                          <div className="truncate">{t.title}</div>
                          <div className="text-xs text-muted-foreground">{t.category} · {new Date(t.updated_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {active.threads.length === 0 && <p className="text-sm text-muted-foreground">No chats.</p>}
                    </div>
                  </div>

                  <div className="glass rounded-3xl p-5">
                    <h3 className="font-display text-base font-bold">Saved items</h3>
                    <div className="mt-3 grid gap-2">
                      {active.saved.map((s: any) => (
                        <div key={s.id} className="rounded-xl border border-border/50 px-3 py-2 text-sm">
                          <div className="truncate">{s.title}</div>
                          <div className="text-xs text-muted-foreground">{s.kind}</div>
                        </div>
                      ))}
                      {active.saved.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved.</p>}
                    </div>
                  </div>
                </div>

                {active.images.length > 0 && (
                  <div className="glass mt-4 rounded-3xl p-5">
                    <h3 className="font-display text-base font-bold">Recent images</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {active.images.flatMap((row: any) =>
                        (Array.isArray(row.images) ? row.images : []).slice(0, 1).map((src: string, i: number) => (
                          <img key={`${row.id}-${i}`} src={src} alt={row.prompt?.slice(0, 60) ?? "Generated image"} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                        )),
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
