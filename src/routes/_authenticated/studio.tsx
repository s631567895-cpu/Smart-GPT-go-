import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Database, Languages, Download, ImageIcon, Loader2, MessageSquare, Play, Plus, Trash2 } from "lucide-react";

import { ToolShell, Panel } from "@/components/tool-shell";
import { MultiLangTab } from "@/components/multilang-tab";
import { checkAdmin } from "@/lib/admin.functions";
import { getOfflinePackStatus, publishOfflinePack, unpublishOfflinePack } from "@/lib/offline.functions";
import { Link } from "@tanstack/react-router";
import {
  listHeadings,
  createHeading,
  deleteHeading,
  listEntries,
  createEntry,
  deleteEntry,
  listConversations,
  createConversation,
  deleteConversation,
  listImages,
  addImage,
  deleteImage,
  listModels,
  createModel,
  activateModel,
  trainMyModel,
  askMyModel,
  listTests,
  createTest,
  deleteTest,
  runTests,
  exportDataset,
  listFolders,
  saveFolder,
  deleteFolder,
} from "@/lib/mindlm.functions";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Training Studio — Smart GPT Go" },
      {
        name: "description",
        content:
          "Build your own AI from your own data: headings, knowledge, conversations, images, training runs and testing.",
      },
      { property: "og:title", content: "Training Studio — Smart GPT Go" },
      {
        property: "og:description",
        content: "Create headings, add knowledge, train your own model and test its answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioPage,
});

const TABS = [
  { id: "database", label: "Database", icon: Database },
  { id: "knowledge", label: "Knowledge", icon: Brain },
  { id: "conversation", label: "Conversation", icon: MessageSquare },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "llm", label: "My LLM", icon: Play },
  { id: "testing", label: "Testing / Preview", icon: Play },
  { id: "multilang", label: "Multi-Language Data", icon: Languages },
] as const;

const input =
  "w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary/60";
const btn =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-2 rounded-xl border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground";

function StudioPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("database");
  const checkAdminFn = useServerFn(checkAdmin);
  const gate = useQuery({ queryKey: ["admin-gate"], queryFn: () => checkAdminFn({}), staleTime: 5 * 60_000 });

  if (gate.isLoading) {
    return (
      <ToolShell title="Training Studio" description="Checking access…">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </ToolShell>
    );
  }
  if (!gate.data?.isAdmin) {
    return (
      <ToolShell title="Training Studio" description="This area is private.">
        <Panel>
          <p className="text-sm text-muted-foreground">Training Studio sirf owner ke liye hai.</p>
          <Link to="/chat" className="mt-4 inline-flex text-sm font-medium text-primary">Go to Smart Chat →</Link>
        </Panel>
      </ToolShell>
    );
  }

  return (
    <ToolShell
      title="Training Studio"
      description="Your own AI, trained only on your own dataset — no outside model in the loop."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              tab === t.id ? "border-primary/60 text-foreground" : "border-border/60 text-muted-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <OfflinePublishBar />
      {tab === "database" && <HeadingsTab />}
      {tab === "database" && <FoldersSection />}
      {tab === "knowledge" && <KnowledgeTab />}
      {tab === "conversation" && <ConversationTab />}
      {tab === "images" && <ImagesTab />}
      {tab === "llm" && <LlmTab />}
      {tab === "testing" && <TestingTab />}
      {tab === "multilang" && <MultiLangTab />}
    </ToolShell>
  );
}

function OfflinePublishBar() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getOfflinePackStatus);
  const pubFn = useServerFn(publishOfflinePack);
  const unpubFn = useServerFn(unpublishOfflinePack);
  const status = useQuery({ queryKey: ["offline-pack"], queryFn: () => statusFn({}) });
  const pub = useMutation({ mutationFn: () => pubFn({}), onSuccess: () => qc.invalidateQueries({ queryKey: ["offline-pack"] }) });
  const unpub = useMutation({ mutationFn: () => unpubFn({}), onSuccess: () => qc.invalidateQueries({ queryKey: ["offline-pack"] }) });
  const s = status.data;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
      <div className="text-sm">
        <span className="font-semibold">Offline AI</span>{" "}
        <span className="text-muted-foreground">
          {s?.published ? `Live for users · ${s.docCount} topics` : "Not shared — only you can see your data"}
        </span>
        {(pub.error || unpub.error) && <p className="text-xs text-destructive">{String((pub.error || unpub.error as Error).message)}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => pub.mutate()} disabled={pub.isPending} className={btn} style={{ background: "var(--gradient-primary)" }}>
          {pub.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {s?.published ? "Update offline copy" : "Publish to Offline AI"}
        </button>
        {s?.published && (
          <button type="button" onClick={() => unpub.mutate()} disabled={unpub.isPending} className={ghost}>Unpublish</button>
        )}
      </div>
    </div>
  );
}

function useHeadings() {
  const fn = useServerFn(listHeadings);
  return useQuery({ queryKey: ["kb-headings"], queryFn: () => fn({}) });
}

/* ---------------- Database ---------------- */

function HeadingsTab() {
  const qc = useQueryClient();
  const headings = useHeadings();
  const createFn = useServerFn(createHeading);
  const deleteFn = useServerFn(deleteHeading);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const add = useMutation({
    mutationFn: () => createFn({ data: { name, description } }),
    onSuccess: () => {
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["kb-headings"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-headings"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">New heading</h2>
        <div className="grid gap-3">
          <input className={input} placeholder="Heading name (e.g. Earth)" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className={`${input} min-h-24`} placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button
            type="button"
            className={btn}
            style={{ background: "var(--gradient-primary)" }}
            disabled={!name.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add heading
          </button>
          {add.isError && <p className="text-xs text-destructive">Could not save. Try again.</p>}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Headings</h2>
        {headings.isLoading && <Loading />}
        {headings.data?.headings.length === 0 && <Empty text="No headings yet." />}
        <div className="grid gap-2">
          {headings.data?.headings.map((h: any) => (
            <div key={h.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{h.name}</p>
                {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
              </div>
              <button type="button" className={ghost} onClick={() => remove.mutate(h.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Folders ---------------- */

function FoldersSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFolders);
  const saveFn = useServerFn(saveFolder);
  const deleteFn = useServerFn(deleteFolder);
  const folders = useQuery({ queryKey: ["kb-folders"], queryFn: () => listFn({}) });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const reset = () => { setOpen(false); setEditId(undefined); setName(""); setContent(""); };
  const save = useMutation({
    mutationFn: (close: boolean) => saveFn({ data: { id: editId, name, content } }).then((r) => ({ r, close })),
    onSuccess: ({ r, close }) => {
      qc.invalidateQueries({ queryKey: ["kb-folders"] });
      if (close) { reset(); setNotice("Folder submitted."); }
      else { setEditId(r.id); setNotice("Saved."); }
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-folders"] }),
  });

  return (
    <div className="mt-6">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Folders</h2>
          {!open && (
            <button type="button" className={btn} style={{ background: "var(--gradient-primary)" }} onClick={() => { reset(); setNotice(""); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Folder
            </button>
          )}
        </div>

        {open && (
          <div className="mb-5 grid gap-3 rounded-xl border border-border/60 p-4">
            <input className={input} placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className={`${input} min-h-40`} placeholder="Add knowledge, text, information or data…" value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghost} disabled={!name.trim() || save.isPending} onClick={() => save.mutate(false)}>Save</button>
              <button type="button" className={btn} style={{ background: "var(--gradient-primary)" }} disabled={!name.trim() || save.isPending} onClick={() => save.mutate(true)}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit
              </button>
              <button type="button" className={ghost} onClick={reset}>Cancel</button>
            </div>
            {save.isError && <p className="text-xs text-destructive">Could not save. Try again.</p>}
          </div>
        )}
        {notice && <p className="mb-3 text-xs text-muted-foreground">{notice}</p>}

        {folders.isLoading && <Loading />}
        {folders.data?.folders.length === 0 && <Empty text="No folders yet." />}
        <div className="grid gap-2">
          {folders.data?.folders.map((f: any) => (
            <div key={f.id} className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left text-sm font-semibold" onClick={() => setViewId(viewId === f.id ? null : f.id)}>
                  📁 {f.name}
                </button>
                <div className="flex gap-2">
                  <button type="button" className={ghost} onClick={() => setViewId(viewId === f.id ? null : f.id)}>{viewId === f.id ? "Close" : "Open"}</button>
                  <button type="button" className={ghost} onClick={() => { setEditId(f.id); setName(f.name); setContent(f.content); setNotice(""); setOpen(true); }}>Edit</button>
                  <button type="button" className={ghost} onClick={() => { if (confirm(`Delete folder "${f.name}"?`)) remove.mutate(f.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {viewId === f.id && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{f.content || "No data yet."}</p>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Knowledge ---------------- */

function KnowledgeTab() {
  const qc = useQueryClient();
  const headings = useHeadings();
  const listFn = useServerFn(listEntries);
  const createFn = useServerFn(createEntry);
  const deleteFn = useServerFn(deleteEntry);

  const [headingId, setHeadingId] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const entries = useQuery({
    queryKey: ["kb-entries", headingId],
    queryFn: () => listFn({ data: headingId ? { headingId } : {} }),
  });

  const add = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          headingId,
          subtopic,
          title,
          content,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      setSubtopic("");
      setTitle("");
      setContent("");
      setTags("");
      qc.invalidateQueries({ queryKey: ["kb-entries"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-entries"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Add knowledge</h2>
        <div className="grid gap-3">
          <select className={input} value={headingId} onChange={(e) => setHeadingId(e.target.value)}>
            <option value="">Select heading…</option>
            {headings.data?.headings.map((h: any) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input className={input} placeholder="Subtopic" value={subtopic} onChange={(e) => setSubtopic(e.target.value)} />
          <input className={input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className={`${input} min-h-40`} placeholder="Detailed knowledge…" value={content} onChange={(e) => setContent(e.target.value)} />
          <input className={input} placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <button
            type="button"
            className={btn}
            style={{ background: "var(--gradient-primary)" }}
            disabled={!headingId || !content.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save
          </button>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Knowledge entries</h2>
        {entries.isLoading && <Loading />}
        {entries.data?.entries.length === 0 && <Empty text="Nothing saved yet." />}
        <div className="grid gap-2">
          {entries.data?.entries.map((e: any) => (
            <div key={e.id} className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{e.title || e.subtopic || "Untitled"}</p>
                <button type="button" className={ghost} onClick={() => remove.mutate(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{e.content}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Conversation ---------------- */

function ConversationTab() {
  const qc = useQueryClient();
  const headings = useHeadings();
  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const deleteFn = useServerFn(deleteConversation);

  const [headingId, setHeadingId] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const conversations = useQuery({ queryKey: ["kb-conversations"], queryFn: () => listFn({}) });
  const add = useMutation({
    mutationFn: () =>
      createFn({ data: { headingId: headingId || null, userMessage, aiMessage } }),
    onSuccess: () => {
      setUserMessage("");
      setAiMessage("");
      qc.invalidateQueries({ queryKey: ["kb-conversations"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-conversations"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Teach a reply style</h2>
        <div className="grid gap-3">
          <select className={input} value={headingId} onChange={(e) => setHeadingId(e.target.value)}>
            <option value="">No heading</option>
            {headings.data?.headings.map((h: any) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <textarea className={`${input} min-h-24`} placeholder="User says…" value={userMessage} onChange={(e) => setUserMessage(e.target.value)} />
          <textarea className={`${input} min-h-32`} placeholder="Your AI should reply…" value={aiMessage} onChange={(e) => setAiMessage(e.target.value)} />
          <button
            type="button"
            className={btn}
            style={{ background: "var(--gradient-primary)" }}
            disabled={!userMessage.trim() || !aiMessage.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save example
          </button>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Examples</h2>
        {conversations.isLoading && <Loading />}
        {conversations.data?.conversations.length === 0 && <Empty text="No examples yet." />}
        <div className="grid gap-2">
          {conversations.data?.conversations.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{c.user_message}</p>
                <button type="button" className={ghost} onClick={() => remove.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.ai_message}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Images ---------------- */

function ImagesTab() {
  const qc = useQueryClient();
  const headings = useHeadings();
  const listFn = useServerFn(listImages);
  const addFn = useServerFn(addImage);
  const deleteFn = useServerFn(deleteImage);

  const [headingId, setHeadingId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const images = useQuery({ queryKey: ["kb-images"], queryFn: () => listFn({}) });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick an image first");
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const b of buf) binary += String.fromCharCode(b);
      return addFn({
        data: {
          headingId: headingId || null,
          label,
          description,
          tags: [],
          fileName: file.name,
          contentType: file.type || "image/png",
          dataBase64: btoa(binary),
        },
      });
    },
    onSuccess: () => {
      setLabel("");
      setDescription("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["kb-images"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-images"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Add a labelled image</h2>
        <div className="grid gap-3">
          <select className={input} value={headingId} onChange={(e) => setHeadingId(e.target.value)}>
            <option value="">No heading</option>
            {headings.data?.headings.map((h: any) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input className={input} placeholder="Label (what is in the picture)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <textarea className={`${input} min-h-24`} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input type="file" accept="image/*" className={input} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button
            type="button"
            className={btn}
            style={{ background: "var(--gradient-primary)" }}
            disabled={!file || !label.trim() || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload
          </button>
          {upload.isError && <p className="text-xs text-destructive">Upload failed. Max size is 8MB.</p>}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Training images</h2>
        {images.isLoading && <Loading />}
        {images.data?.images.length === 0 && <Empty text="No images yet." />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.data?.images.map((im: any) => (
            <div key={im.id} className="rounded-xl border border-border/60 p-2">
              {im.url && (
                <img src={im.url} alt={im.label} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
              )}
              <p className="mt-2 truncate text-xs font-semibold">{im.label}</p>
              <button type="button" className={`${ghost} mt-1`} onClick={() => remove.mutate(im.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- My LLM ---------------- */

function LlmTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listModels);
  const createFn = useServerFn(createModel);
  const activateFn = useServerFn(activateModel);
  const trainFn = useServerFn(trainMyModel);
  const exportFn = useServerFn(exportDataset);
  const [name, setName] = useState("MindLM");

  const models = useQuery({ queryKey: ["kb-models"], queryFn: () => listFn({}) });
  const create = useMutation({
    mutationFn: () => createFn({ data: { name, version: (models.data?.models.length ?? 0) + 1 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-models"] }),
  });
  const activate = useMutation({
    mutationFn: (id: string) => activateFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-models"] }),
  });
  const train = useMutation({
    mutationFn: (modelId: string) => trainFn({ data: { modelId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-models"] }),
  });

  async function downloadDataset() {
    const data = await exportFn({});
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartgptgo-dataset.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const ds = models.data?.dataset;

  return (
    <div className="grid gap-6">
      <Panel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Headings" value={ds?.headings ?? 0} />
          <Stat label="Knowledge" value={ds?.entries ?? 0} />
          <Stat label="Conversations" value={ds?.conversations ?? 0} />
          <Stat label="Images" value={ds?.images ?? 0} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input className={`${input} max-w-56`} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className={btn} style={{ background: "var(--gradient-primary)" }} disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New model version
          </button>
          <button type="button" className={ghost} onClick={downloadDataset}>
            <Download className="h-3.5 w-3.5" /> Export dataset
          </button>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Model versions</h2>
        {models.isLoading && <Loading />}
        {models.data?.models.length === 0 && <Empty text="Create your first model version to start training." />}
        <div className="grid gap-2">
          {models.data?.models.map((m: any) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {m.name} v{m.version} {m.is_active && <span className="ml-2 text-xs text-primary">active</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.status} · {m.vocab_size} terms · {m.doc_count} documents
                </p>
              </div>
              <div className="flex gap-2">
                {!m.is_active && (
                  <button type="button" className={ghost} onClick={() => activate.mutate(m.id)}>
                    Make active
                  </button>
                )}
                <button
                  type="button"
                  className={btn}
                  style={{ background: "var(--gradient-primary)" }}
                  disabled={train.isPending}
                  onClick={() => train.mutate(m.id)}
                >
                  {train.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Train
                </button>
              </div>
            </div>
          ))}
        </div>
        {train.isError && <p className="mt-3 text-xs text-destructive">{String((train.error as Error)?.message ?? "Training failed")}</p>}
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Training runs</h2>
        {models.data?.runs.length === 0 && <Empty text="No training runs yet." />}
        <div className="grid gap-2">
          {models.data?.runs.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">{r.status}</p>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.log}</pre>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Testing / Preview ---------------- */

function TestingTab() {
  const qc = useQueryClient();
  const askFn = useServerFn(askMyModel);
  const listFn = useServerFn(listTests);
  const createFn = useServerFn(createTest);
  const deleteFn = useServerFn(deleteTest);
  const runFn = useServerFn(runTests);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [tq, setTq] = useState("");
  const [expected, setExpected] = useState("");

  const tests = useQuery({ queryKey: ["kb-tests"], queryFn: () => listFn({}) });
  const ask = useMutation({
    mutationFn: (askedQuestion: string) => askFn({ data: { question: askedQuestion, history } }),
    onSuccess: (res, askedQuestion) => {
      setAnswer(res);
      setHistory((previous) => [
        ...previous,
        { role: "user" as const, text: askedQuestion.slice(0, 4000) },
        { role: "assistant" as const, text: (res.answer ?? "").slice(0, 4000) },
      ].slice(-20));
    },
  });
  const add = useMutation({
    mutationFn: () => createFn({ data: { question: tq, expected } }),
    onSuccess: () => {
      setTq("");
      setExpected("");
      qc.invalidateQueries({ queryKey: ["kb-tests"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-tests"] }),
  });
  const run = useMutation({
    mutationFn: () => runFn({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-tests"] }),
  });

  return (
    <div className="grid gap-6">
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Ask your model</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${input} flex-1`}
            placeholder="Ask a question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim() && !ask.isPending) ask.mutate(question.trim());
            }}
          />
          <button
            type="button"
            className={btn}
            style={{ background: "var(--gradient-primary)" }}
            disabled={!question.trim() || ask.isPending}
            onClick={() => ask.mutate(question.trim())}
          >
            {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />} Ask
          </button>
        </div>
        {answer && (
          <div className="mt-4 rounded-xl border border-border/60 p-4">
            <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {answer.model ?? "no model"} · heading: {answer.heading ?? "—"} · confidence:{" "}
              {Math.round((answer.confidence ?? 0) * 100)}%
            </p>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Test set</h2>
          <button type="button" className={btn} style={{ background: "var(--gradient-primary)" }} disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run all tests
          </button>
        </div>
        {run.data && (
          <p className="mb-3 text-xs text-muted-foreground">
            {run.data.count} tests · average score {Math.round(run.data.avgScore * 100)}%
          </p>
        )}
        {run.isError && <p className="mb-3 text-xs text-destructive">{String((run.error as Error)?.message)}</p>}

        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className={input} placeholder="Question" value={tq} onChange={(e) => setTq(e.target.value)} />
          <input className={input} placeholder="Expected answer (optional)" value={expected} onChange={(e) => setExpected(e.target.value)} />
          <button type="button" className={ghost} disabled={!tq.trim() || add.isPending} onClick={() => add.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Add test
          </button>
        </div>

        {tests.isLoading && <Loading />}
        {tests.data?.tests.length === 0 && <Empty text="No tests yet." />}
        <div className="grid gap-2">
          {tests.data?.tests.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{t.question}</p>
                <button type="button" className={ghost} onClick={() => remove.mutate(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {t.last_answer && <p className="mt-1 text-xs text-muted-foreground">{t.last_answer}</p>}
              {t.last_score !== null && t.last_score !== undefined && (
                <p className="mt-1 text-xs text-primary">score {Math.round(t.last_score * 100)}%</p>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- small bits ---------------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
