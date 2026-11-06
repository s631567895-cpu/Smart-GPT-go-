import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createParser } from "eventsource-parser";
import { Loader2, Mic, Play, Pause, Download, Sparkles, Volume2, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { ToolShell, Panel } from "@/components/tool-shell";
import { getVoiceCredits, PER_GEN_MAX_SECONDS } from "@/lib/voice.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/voice")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI Voice — Smart GPT" },
      { name: "description", content: "Turn text into natural speech with 10 AI voices. Free daily credits." },
    ],
  }),
  component: VoicePage,
});

type VoiceOpt = { id: string; label: string; accent: string; emoji: string };
const VOICES: VoiceOpt[] = [
  { id: "alloy", label: "Alloy", accent: "Neutral · Balanced", emoji: "🎙️" },
  { id: "ash", label: "Ash", accent: "Warm · Male", emoji: "🧔" },
  { id: "ballad", label: "Ballad", accent: "Soft · Storyteller", emoji: "🎼" },
  { id: "coral", label: "Coral", accent: "Bright · Female", emoji: "🌸" },
  { id: "echo", label: "Echo", accent: "Cool · Male", emoji: "🌊" },
  { id: "fable", label: "Fable", accent: "British · Narrator", emoji: "📖" },
  { id: "nova", label: "Nova", accent: "Cheerful · Female", emoji: "✨" },
  { id: "onyx", label: "Onyx", accent: "Deep · Male", emoji: "🖤" },
  { id: "sage", label: "Sage", accent: "Calm · Wise", emoji: "🧘" },
  { id: "shimmer", label: "Shimmer", accent: "Friendly · Female", emoji: "💫" },
];

// Approx 15 chars per second at natural pace
function estimateSeconds(text: string) {
  const s = Math.ceil(text.trim().length / 15);
  return Math.max(1, Math.min(PER_GEN_MAX_SECONDS, s));
}

function VoicePage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<string>("alloy");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const qc = useQueryClient();
  const creditsFn = useServerFn(getVoiceCredits);
  const credits = useQuery({ queryKey: ["voice-credits"], queryFn: () => creditsFn() });

  const estSec = estimateSeconds(text);
  const overCap = estSec > PER_GEN_MAX_SECONDS || text.length > 900;
  const outOfCredit = (credits.data?.remainingSeconds ?? 0) < estSec;

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function generate() {
    const input = text.trim();
    if (!input) return;
    if (overCap) { toast.error(`Max ${PER_GEN_MAX_SECONDS}s per generation. Shorten your script.`); return; }
    setBusy(true); setPct(2); setAudioUrl(null); setPlaying(false);

    try {
      // Quota is checked and reserved server-side inside /api/tts.
      const { data } = await supabase.auth.getSession();

      const token = data.session?.access_token;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ input, voice }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `TTS failed: ${res.status}`);
      }

      // Approximate total bytes: mp3 ≈ 4KB/sec at ~32kbps
      const estBytes = Math.max(20_000, estSec * 4500);
      const chunks: Uint8Array[] = [];
      let received = 0;

      const parser = createParser({
        onEvent(event) {
          let payload: { type?: string; audio?: string };
          try { payload = JSON.parse(event.data); } catch { return; }
          if (payload.type === "speech.audio.delta" && payload.audio) {
            const bin = atob(payload.audio);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            chunks.push(bytes);
            received += bytes.length;
            const p = Math.min(96, Math.max(5, Math.round((received / estBytes) * 90)));
            setPct(p);
          }
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(value);
      }

      const totalLen = chunks.reduce((a, b) => a + b.length, 0);
      const merged = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      const blob = new Blob([new Uint8Array(merged)], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setPct(100);
      qc.invalidateQueries({ queryKey: ["voice-credits"] });
      toast.success("Voice ready!");
    } catch (e) {
      const msg = e instanceof Error ? e.message.trim() : "";
      toast.error(msg && msg.length < 200 && !msg.startsWith("{") ? msg : "Voice generation failed. Please try again.");
      setPct(0);

    } finally {
      setBusy(false);
    }
  }

  function togglePlay() {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  }

  function download() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl; a.download = `smartgrowth-voice-${Date.now()}.mp3`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  const remain = credits.data?.remainingSeconds ?? 0;
  const cap = credits.data?.dailyCap ?? 30;
  const remainPct = cap > 0 ? Math.round((remain / cap) * 100) : 0;

  return (
    <ToolShell
      title="AI Voice"
      description="Text daalo, voice select karo, generate. 10 natural AI voices — free daily credits."
    >
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {credits.isLoading ? "…" : `${remain}s / ${cap}s daily credits left`}
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-border/40">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${remainPct}%` }} />
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Apna script yahan likho (max ~30 seconds)..."
          rows={4}
          maxLength={950}
          className="w-full resize-none rounded-xl border border-border bg-input/40 px-4 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{text.length}/900 chars · est. {estSec}s</span>
          {overCap && <span className="text-rose-400">Too long — max {PER_GEN_MAX_SECONDS}s</span>}
          {outOfCredit && !overCap && <span className="text-amber-400">Not enough credits today</span>}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Choose voice</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {VOICES.map((v) => {
              const active = voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(v.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                      : "border-border/60 bg-card/40 hover:border-border"
                  }`}
                >
                  <div className="text-lg">{v.emoji}</div>
                  <div className="mt-1 text-sm font-semibold">{v.label}</div>
                  <div className="text-[10px] text-muted-foreground">{v.accent}</div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={busy || !text.trim() || overCap || outOfCredit}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? `Generating… ${pct}%` : "Generate Voice"}
        </button>

        {busy && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
              <div className="h-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-center font-display text-2xl font-bold text-primary">{pct}%</div>
          </div>
        )}
      </Panel>

      {audioUrl && (
        <Panel className="mt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium">Your voice is ready</div>
              <div className="text-xs text-muted-foreground">Voice: {VOICES.find(v => v.id === voice)?.label}</div>
            </div>
            <button
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm hover:text-foreground"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setPlaying(false)}
            controls
            className="mt-4 w-full"
          />
        </Panel>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
        <Panel className="!p-4"><Volume2 className="h-4 w-4 text-primary mb-1" /><b className="text-foreground">10 voices</b><div>Male, female, narrator, calm — pick the vibe.</div></Panel>
        <Panel className="!p-4"><Zap className="h-4 w-4 text-primary mb-1" /><b className="text-foreground">Live progress</b><div>Streaming % as your voice generates.</div></Panel>
        <Panel className="!p-4"><Clock className="h-4 w-4 text-primary mb-1" /><b className="text-foreground">Free daily credits</b><div>30 seconds free every day. Upgrade for more.</div></Panel>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground"
        >
          <Mic className="h-3.5 w-3.5" /> Upgrade for unlimited voices — Coming Soon
        </button>
      </div>
    </ToolShell>
  );
}
