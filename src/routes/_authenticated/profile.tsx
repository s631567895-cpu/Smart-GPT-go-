import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, User, Save, Award, Brain, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { getProfile, updateProfile, getDashboardStats } from "@/lib/profile.functions";
import { listUserMemory, saveUserMemory, deleteUserMemory } from "@/lib/user-memory.functions";
import { COUNTRIES, LANGUAGE_GROUPS } from "@/lib/creator-options";
import { SearchableSelect } from "@/components/searchable-select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "Profile & AI Memory — Smart GPT" },
    { name: "description", content: "Manage your Smart GPT profile and private long-term AI memories." },
    { property: "og:title", content: "Profile & AI Memory — Smart GPT" },
    { property: "og:description", content: "Manage your profile, preferences and private AI memory." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  ssr: false,
  component: ProfilePage,
});

const BADGES: Record<string, { label: string; emoji: string; desc: string }> = {
  first_chat: { label: "First Chat", emoji: "💬", desc: "Started your first AI conversation" },
  first_image: { label: "First Image", emoji: "🎨", desc: "Created your first AI image" },
  streak_3: { label: "3-day Streak", emoji: "🔥", desc: "Active 3 days in a row" },
  streak_7: { label: "7-day Streak", emoji: "⚡", desc: "Active 7 days in a row" },
  saver: { label: "Vault Collector", emoji: "📚", desc: "Saved your first item" },
};

const MEMORY_KINDS = [
  { value: "name", label: "Name" },
  { value: "language", label: "Preferred language" },
  { value: "preference", label: "Preference" },
  { value: "project", label: "Project" },
  { value: "note", label: "Note" },
] as const;

function ProfilePage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getProfile);
  const updateFn = useServerFn(updateProfile);
  const statsFn = useServerFn(getDashboardStats);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getFn() });
  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");

  // AI Memory — long-term facts the chat AI remembers about you.
  const listMemFn = useServerFn(listUserMemory);
  const saveMemFn = useServerFn(saveUserMemory);
  const delMemFn = useServerFn(deleteUserMemory);
  const memories = useQuery({ queryKey: ["user-memory"], queryFn: () => listMemFn({}) });
  const [memKind, setMemKind] = useState<string>("note");
  const [memText, setMemText] = useState("");

  useEffect(() => {
    if (profile.data?.profile) {
      setName(profile.data.profile.display_name ?? "");
      setAvatar(profile.data.profile.avatar_url ?? "");
      setCountry(profile.data.profile.country ?? "");
      setLanguage(profile.data.profile.language ?? "");
    }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          display_name: name.trim() || "User",
          avatar_url: avatar.trim() || null,
          ...(country ? { country } : {}),
          ...(language ? { language } : {}),
        },
      }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: () => toast.error("Save failed"),
  });

  const saveMem = useMutation({
    mutationFn: () => saveMemFn({ data: { kind: memKind as "name" | "language" | "preference" | "project" | "note", content: memText } }),
    onSuccess: () => { toast.success("Memory saved"); setMemText(""); qc.invalidateQueries({ queryKey: ["user-memory"] }); },
    onError: () => toast.error("Save failed"),
  });

  const delMem = useMutation({
    mutationFn: (id: string) => delMemFn({ data: { id } }),
    onSuccess: () => { toast.success("Memory removed"); qc.invalidateQueries({ queryKey: ["user-memory"] }); },
    onError: () => toast.error("Delete failed"),
  });

  const joined = profile.data?.profile?.created_at ? new Date(profile.data.profile.created_at).toLocaleDateString() : "—";
  const totalCreations = (stats.data?.chats ?? 0) + (stats.data?.images ?? 0) + (stats.data?.saved ?? 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Profile</h1>
        <p className="mt-2 text-muted-foreground">Manage your identity and achievements.</p>

        <div className="mt-8 glass rounded-3xl p-5 sm:p-7">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background/40">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-xl font-semibold">{name || "Your name"}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
              <div className="mt-1 text-xs text-muted-foreground">Joined {joined}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-border bg-input/40 px-4 py-3 outline-none focus:border-primary/60" />
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Avatar URL (optional)</label>
            <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="rounded-xl border border-border bg-input/40 px-4 py-3 outline-none focus:border-primary/60" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableSelect
                label="Country"
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
                placeholder="Choose a country"
                searchPlaceholder="Search countries…"
              />
              <SearchableSelect
                label="Preferred language"
                value={language}
                onChange={setLanguage}
                groups={LANGUAGE_GROUPS}
                placeholder="Choose a language"
                searchPlaceholder="Search languages…"
              />
            </div>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save profile
            </button>
          </div>
        </div>

        <div className="mt-8 glass rounded-3xl p-5 sm:p-7">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <Brain className="h-5 w-5 text-primary" /> AI Memory
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Important long-term facts about you. Smart Chat uses them only when they are relevant to the question.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)_auto]">
            <select
              value={memKind}
              onChange={(e) => setMemKind(e.target.value)}
              className="rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            >
              {MEMORY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <input
              value={memText}
              onChange={(e) => setMemText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && memText.trim()) saveMem.mutate(); }}
              placeholder="e.g. Meri bhasha Hinglish hai · Main YouTube scripts banata hoon"
              className="rounded-xl border border-border bg-input/40 px-4 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            <button
              onClick={() => memText.trim() && saveMem.mutate()}
              disabled={!memText.trim() || saveMem.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saveMem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {(memories.data?.memories ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Koi memory saved nahi hai. Upar se add karein.</p>
            )}
            {(memories.data?.memories ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-4 py-2.5">
                <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium capitalize text-primary">{m.kind}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{m.content}</span>
                <button
                  onClick={() => delMem.mutate(m.id)}
                  aria-label="Delete memory"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-3">
          <Mini label="Total creations" value={totalCreations} />
          <Mini label="Streak" value={stats.data?.streak ?? 0} />
          <Mini label="Badges" value={stats.data?.badges.length ?? 0} />
        </div>

        <div className="mt-10">
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-xl font-semibold">
            <Award className="h-5 w-5 text-primary" /> Achievements
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(BADGES).map(([code, b]) => {
              const earned = stats.data?.badges.includes(code);
              return (
                <div key={code} className={`glass flex items-center gap-3 rounded-2xl p-4 ${earned ? "" : "opacity-50"}`}>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-2xl">{b.emoji}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{b.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
