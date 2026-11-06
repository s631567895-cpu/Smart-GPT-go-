import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, Pencil, RefreshCw, Save, Trash2, Wand2 } from "lucide-react";

import { Panel } from "@/components/tool-shell";
import { MultiLangKnowledge } from "@/components/multilang-knowledge";
import { listHeadings } from "@/lib/mindlm.functions";
import {
  listLanguages,
  listMlItems,
  createMlItems,
  translateMlItem,
  saveMlTranslation,
  deleteMlItem,
} from "@/lib/multilang.functions";

const input =
  "w-full rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary/60";
const btn =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50";

type Lang = { code: string; name: string; native_name: string; is_source: boolean };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-muted-foreground" },
  generating: { label: "Generating…", cls: "text-primary" },
  completed: { label: "Completed", cls: "text-primary" },
  failed: { label: "Translation Failed", cls: "text-destructive" },
  needs_review: { label: "Needs review", cls: "text-accent-foreground" },
};

/** Run tasks with limited parallelism; one failure never stops the others. */
async function pool<T>(tasks: Array<() => Promise<T>>, size: number) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      try { await t!(); } catch { /* status already stored per language */ }
    }
  });
  await Promise.all(workers);
}

export function MultiLangTab() {
  const qc = useQueryClient();
  const langsFn = useServerFn(listLanguages);
  const itemsFn = useServerFn(listMlItems);
  const headingsFn = useServerFn(listHeadings);
  const createFn = useServerFn(createMlItems);
  const translateFn = useServerFn(translateMlItem);

  const langs = useQuery({ queryKey: ["kb-langs"], queryFn: () => langsFn({}) });
  const items = useQuery({ queryKey: ["kb-ml-items"], queryFn: () => itemsFn({}) });
  const headings = useQuery({ queryKey: ["kb-headings"], queryFn: () => headingsFn({}) });

  const [text, setText] = useState("");
  const [batch, setBatch] = useState(false);
  const [headingId, setHeadingId] = useState("");
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const targets: Lang[] = (langs.data?.languages ?? []).filter((l: Lang) => !l.is_source);
  const refresh = () => qc.invalidateQueries({ queryKey: ["kb-ml-items"] });

  async function generate(ids: string[], codes?: (id: string) => string[]) {
    setRunning(true);
    const tasks = ids.flatMap((id) =>
      (codes ? codes(id) : targets.map((l) => l.code)).map((code) => async () => {
        await translateFn({ data: { id, code } });
        refresh();
      }),
    );
    await pool(tasks, 4);
    setRunning(false);
    refresh();
  }

  async function submit() {
    const texts = batch ? text.split(/\n\s*\n|\n(?=\s*Data\s*\d+)/i).map((t) => t.trim()).filter(Boolean) : [text.trim()];
    if (!texts.length) return;
    const { ids } = await createFn({ data: { texts, heading_id: headingId || null } });
    setText("");
    refresh();
    await generate(ids);
  }

  const all: any[] = items.data?.items ?? [];
  const pendingOf = (id: string) => {
    const it = all.find((x) => x.id === id);
    return targets.map((l) => l.code).filter((c) => !it?.translations?.[c] || ["failed", "pending"].includes(it?.statuses?.[c]));
  };

  return (
    <div className="grid gap-6">
      <MultiLangKnowledge />
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">Multi-Language Data</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Write once in Hindi. It stays the original — the other languages are generated from it and saved with it.
          Translation uses the app's built-in AI; your MindLM answers still come only from your data.
        </p>
        <div className="grid gap-3">
          <label className="text-sm font-semibold">Original Hindi Data</label>
          <textarea
            className={`${input} min-h-48`}
            placeholder={batch ? "Data 1…\n\nData 2…\n\n(leave an empty line between items)" : "पृथ्वी सूर्य के चारों ओर घूमती है।"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} /> Batch mode (many items)
            </label>
            <select className={`${input} w-auto`} value={headingId} onChange={(e) => setHeadingId(e.target.value)}>
              <option value="">No heading</option>
              {(headings.data?.headings ?? []).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <button
              type="button"
              className={btn}
              style={{ background: "var(--gradient-primary)" }}
              disabled={!text.trim() || running || !targets.length}
              onClick={submit}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate All Languages
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">{targets.length + 1} languages: {(langs.data?.languages ?? []).map((l: Lang) => l.name).join(", ")}</p>
        </div>
      </Panel>

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <button type="button" className={ghost} onClick={() => setSelected(new Set(all.map((i) => i.id)))}>Select all</button>
          <button type="button" className={ghost} onClick={() => setSelected(new Set())}>Clear</button>
          <button
            type="button"
            className={ghost}
            disabled={!selected.size || running}
            onClick={() => generate([...selected], pendingOf)}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Generate All (missing / failed)
          </button>
        </div>
      )}

      {items.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {all.map((it) => (
        <ItemCard
          key={it.id}
          item={it}
          targets={targets}
          selected={selected.has(it.id)}
          onSelect={(v) => setSelected((s) => { const n = new Set(s); v ? n.add(it.id) : n.delete(it.id); return n; })}
          onRetry={(code) => generate([it.id], () => [code])}
          busy={running}
        />
      ))}
    </div>
  );
}

function ItemCard({ item, targets, selected, onSelect, onRetry, busy }: {
  item: any; targets: Lang[]; selected: boolean; onSelect: (v: boolean) => void; onRetry: (code: string) => void; busy: boolean;
}) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteMlItem);
  const del = useMutation({ mutationFn: () => delFn({ data: { id: item.id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-ml-items"] }) });
  const done = targets.filter((l) => ["completed", "needs_review"].includes(item.statuses?.[l.code])).length;

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
          v{item.version} · {done}/{targets.length} languages
        </label>
        <button type="button" className={ghost} onClick={() => del.mutate()}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <LangCard code="hi" name="Hindi" text={item.original_hindi} original itemId={item.id} />
        {targets.map((l) => (
          <LangCard
            key={l.code}
            code={l.code}
            name={l.name}
            text={item.translations?.[l.code] ?? ""}
            status={item.statuses?.[l.code] ?? "pending"}
            itemId={item.id}
            onRegenerate={() => onRetry(l.code)}
            busy={busy}
          />
        ))}
      </div>
    </Panel>
  );
}

function LangCard({ code, name, text, status, original, itemId, onRegenerate, busy }: {
  code: string; name: string; text: string; status?: string; original?: boolean; itemId: string; onRegenerate?: () => void; busy?: boolean;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveMlTranslation);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: itemId, code, text: draft } }),
    onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ["kb-ml-items"] }); },
  });
  const st = status ? STATUS[status] ?? STATUS.pending! : null;

  return (
    <div className="flex flex-col rounded-xl border border-border/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{name} <span className="text-xs text-muted-foreground">({code})</span></p>
        <span className={`rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${original ? "text-primary" : "text-muted-foreground"}`}>
          {original ? "ORIGINAL" : "GENERATED"}
        </span>
      </div>
      {st && <p className={`mb-1 text-[11px] ${st.cls}`}>{status === "generating" && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{st.label}</p>}
      {editing ? (
        <textarea className={`${input} min-h-28`} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <p className="min-h-12 whitespace-pre-wrap break-words text-sm" dir={code === "ar" ? "rtl" : undefined}>
          {text || <span className="text-muted-foreground">—</span>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {!original && (
          editing ? (
            <button type="button" className={ghost} disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          ) : (
            <button type="button" className={ghost} onClick={() => { setDraft(text); setEditing(true); }}><Pencil className="h-3 w-3" /> Edit</button>
          )
        )}
        {!original && (
          <button type="button" className={ghost} disabled={busy} onClick={onRegenerate}>
            <RefreshCw className="h-3 w-3" /> {status === "failed" ? "Retry" : "Regenerate"}
          </button>
        )}
        <button
          type="button"
          className={ghost}
          disabled={!text}
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
        </button>
        {!original && !editing && status === "needs_review" && (
          <button type="button" className={ghost} onClick={() => { setDraft(text); save.mutate(); }}><Save className="h-3 w-3" /> Save as reviewed</button>
        )}
      </div>
    </div>
  );
}
