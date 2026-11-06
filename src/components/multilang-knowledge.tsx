import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Panel } from "@/components/tool-shell";
import { listLanguages, listSourceHeadings, translateHeadingTo } from "@/lib/multilang.functions";

type Lang = { code: string; name: string; is_source: boolean };

const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50";

export function MultiLangKnowledge() {
  const qc = useQueryClient();
  const langsFn = useServerFn(listLanguages);
  const headsFn = useServerFn(listSourceHeadings);
  const trFn = useServerFn(translateHeadingTo);
  const langs = useQuery({ queryKey: ["kb-langs"], queryFn: () => langsFn({}) });
  const heads = useQuery({ queryKey: ["kb-ml-heads"], queryFn: () => headsFn({}) });
  const targets: Lang[] = (langs.data?.languages ?? []).filter((l: Lang) => !l.is_source);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["kb-ml-heads"] });
    qc.invalidateQueries({ queryKey: ["kb-headings"] });
  };

  async function run(pairs: Array<[string, string]>) {
    setRunning(true);
    let i = 0;
    const worker = async () => {
      while (i < pairs.length) {
        const [h, c] = pairs[i++]!;
        const k = `${h}:${c}`;
        setBusy((b) => ({ ...b, [k]: true }));
        try {
          const r = await trFn({ data: { headingId: h, code: c } });
          setErrors((e) => ({ ...e, [k]: r.status === "failed" ? (r as any).error ?? "Failed" : "" }));
        } catch (err) {
          setErrors((e) => ({ ...e, [k]: err instanceof Error ? err.message : "Failed" }));
        }
        setBusy((b) => ({ ...b, [k]: false }));
        refresh();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, pairs.length) }, worker));
    setRunning(false);
  }

  const list = heads.data?.headings ?? [];
  const allPairs = list.flatMap((h) => targets.map((l) => [h.id, l.code] as [string, string]));
  const missingPairs = list.flatMap((h) =>
    targets.filter((l) => h.translations[l.code]?.status !== "completed").map((l) => [h.id, l.code] as [string, string]),
  );

  return (
    <Panel>
      <h2 className="mb-1 font-display text-lg font-semibold">Translate Database + Knowledge</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Your original headings and knowledge (topic, title, tags, details) stay untouched. Each language gets its own
        separate heading with all entries translated — e.g. Chinese, Japanese, Korean, Hinglish.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-primary)" }}
          disabled={running || !missingPairs.length}
          onClick={() => run(missingPairs)}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate All Languages
        </button>
        <button type="button" className={ghost} disabled={running || !allPairs.length} onClick={() => run(allPairs)}>
          <RefreshCw className="h-3.5 w-3.5" /> Re-translate everything
        </button>
      </div>
      {heads.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!heads.isLoading && !list.length && <p className="text-sm text-muted-foreground">Add headings and knowledge first.</p>}
      <div className="grid gap-3">
        {list.map((h) => (
          <div key={h.id} className="rounded-xl border border-border/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{h.name} <span className="text-xs text-muted-foreground">· {h.entries} knowledge</span></p>
              <button type="button" className={ghost} disabled={running} onClick={() => run(targets.map((l) => [h.id, l.code]))}>
                <Wand2 className="h-3 w-3" /> This heading
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targets.map((l) => {
                const k = `${h.id}:${l.code}`;
                const t = h.translations[l.code];
                const st = busy[k] ? "generating" : t?.status || "pending";
                const cls = st === "completed" ? "text-primary" : st === "failed" ? "text-destructive" : "text-muted-foreground";
                return (
                  <button
                    key={l.code}
                    type="button"
                    title={errors[k] || t?.name || ""}
                    disabled={running}
                    onClick={() => run([[h.id, l.code]])}
                    className={`inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[11px] ${cls}`}
                  >
                    {st === "generating" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {l.name}: {st === "completed" ? "✓" : st === "failed" ? "Retry" : st === "generating" ? "…" : "—"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
