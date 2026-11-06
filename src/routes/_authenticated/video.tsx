import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Video, Upload, Scissors, Type as TypeIcon, Music, Download,
  Play, Pause, Trash2, Plus, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ToolShell, Panel } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/video")({
  head: () => ({ meta: [{ title: "AI Video Studio — Smart GPT" }] }),
  ssr: false,
  component: VideoStudio,
});

type TextOverlay = {
  id: string;
  text: string;
  x: number; // 0-100 %
  y: number; // 0-100 %
  size: number;
  color: string;
  start: number;
  end: number;
};

function uid() { return Math.random().toString(36).slice(2, 9); }

function VideoStudio() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [trim, setTrim] = useState<[number, number]>([0, 0]);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [videoVolume, setVideoVolume] = useState(1);
  const [exporting, setExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  function onVideoFile(f: File) {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setVideoName(f.name);
    setOverlays([]);
  }
  function onAudioFile(f: File) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
  }

  function onLoaded() {
    const v = videoRef.current; if (!v) return;
    setDuration(v.duration);
    setTrim([0, v.duration]);
  }

  // Draw preview loop
  useEffect(() => {
    function tick() {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const w = c.width = v.videoWidth || 720;
        const h = c.height = v.videoHeight || 1280;
        const ctx = c.getContext("2d");
        const t = v.currentTime;
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          for (const o of overlays) {
            if (t < o.start || t > o.end) continue;
            ctx.font = `bold ${o.size}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            const x = (o.x / 100) * w;
            const y = (o.y / 100) * h;
            const metrics = ctx.measureText(o.text);
            const pad = o.size * 0.4;
            ctx.fillRect(x - metrics.width / 2 - pad, y - o.size / 2 - pad / 2, metrics.width + pad * 2, o.size + pad);
            ctx.fillStyle = o.color;
            ctx.fillText(o.text, x, y);
          }
        }
        setCurrentTime(t);
        // Loop within trim range
        if (t >= trim[1] && playing) {
          v.pause();
          if (audioRef.current) audioRef.current.pause();
          setPlaying(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [overlays, playing, trim]);

  function togglePlay() {
    const v = videoRef.current; if (!v) return;
    if (playing) {
      v.pause();
      if (audioRef.current) audioRef.current.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < trim[0] || v.currentTime >= trim[1]) v.currentTime = trim[0];
      v.volume = videoVolume;
      v.play().catch(() => {});
      if (audioRef.current) {
        audioRef.current.volume = audioVolume;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setPlaying(true);
    }
  }

  function seek(t: number) {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Math.min(Math.max(t, trim[0]), trim[1]);
  }

  function addOverlay() {
    setOverlays((o) => [...o, {
      id: uid(), text: "Your text here", x: 50, y: 85, size: 56,
      color: "#ffffff", start: trim[0], end: trim[1],
    }]);
  }
  function updateOverlay(id: string, patch: Partial<TextOverlay>) {
    setOverlays((o) => o.map((x) => x.id === id ? { ...x, ...patch } : x));
  }
  function removeOverlay(id: string) {
    setOverlays((o) => o.filter((x) => x.id !== id));
  }

  async function exportVideo() {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    setExporting(true);
    try {
      v.pause();
      if (audioRef.current) audioRef.current.pause();
      v.currentTime = trim[0];
      v.volume = videoVolume;
      await new Promise((r) => setTimeout(r, 150));

      const stream = c.captureStream(30);
      // Audio: mix video + music via WebAudio
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const dest = ac.createMediaStreamDestination();
      try {
        const src1 = ac.createMediaElementSource(v);
        const g1 = ac.createGain(); g1.gain.value = videoVolume;
        src1.connect(g1).connect(dest);
      } catch { /* already connected */ }
      if (audioRef.current && audioUrl) {
        try {
          const src2 = ac.createMediaElementSource(audioRef.current);
          const g2 = ac.createGain(); g2.gain.value = audioVolume;
          src2.connect(g2).connect(dest);
        } catch { /* ignore */ }
      }
      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); });

      rec.start();
      v.play();
      if (audioRef.current && audioUrl) { audioRef.current.currentTime = 0; audioRef.current.play(); }

      await new Promise<void>((resolve) => {
        const check = () => {
          if (v.currentTime >= trim[1] - 0.05) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
      v.pause();
      if (audioRef.current) audioRef.current.pause();
      rec.stop();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartgrowth-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Video exported!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ToolShell
      title="AI Video Studio"
      description="Import → Trim → Add text → Add music → Export. Browser-based editor, no upload needed."
    >
      {!videoUrl ? (
        <Panel>
          <label className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-center cursor-pointer hover:bg-primary/10 transition">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Upload a video to edit</div>
              <div className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV — up to ~200MB works smoothly</div>
            </div>
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); }} />
          </label>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm text-muted-foreground">
            {[
              { icon: Scissors, t: "Trim & cut" },
              { icon: TypeIcon, t: "Text overlays" },
              { icon: Music, t: "Background music" },
            ].map((f) => (
              <div key={f.t} className="glass rounded-xl p-3 flex items-center gap-2">
                <f.icon className="h-4 w-4 text-primary" /> {f.t}
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),320px]">
          <div className="space-y-4">
            <Panel className="p-3">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <canvas ref={canvasRef} className="w-full h-auto max-h-[60vh] object-contain" />
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="hidden"
                  onLoadedMetadata={onLoaded}
                  onEnded={() => setPlaying(false)}
                  crossOrigin="anonymous"
                  playsInline
                />
                {audioUrl && <audio ref={audioRef} src={audioUrl} loop crossOrigin="anonymous" />}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button size="icon" onClick={togglePlay} variant="secondary">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="text-xs tabular-nums text-muted-foreground w-24">
                  {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                </div>
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 1}
                  step={0.05}
                  onValueChange={(v) => seek(v[0])}
                  className="flex-1"
                />
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <Scissors className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Trim</h3>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {trim[0].toFixed(1)}s → {trim[1].toFixed(1)}s ({(trim[1] - trim[0]).toFixed(1)}s)
                </span>
              </div>
              <Slider
                value={trim}
                min={0}
                max={duration || 1}
                step={0.05}
                onValueChange={(v) => setTrim([v[0], v[1]] as [number, number])}
              />
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <TypeIcon className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Text overlays</h3>
                <Button size="sm" variant="secondary" className="ml-auto" onClick={addOverlay}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add text
                </Button>
              </div>
              {overlays.length === 0 ? (
                <p className="text-xs text-muted-foreground">No overlays yet. Add captions, titles, or callouts.</p>
              ) : (
                <div className="space-y-3">
                  {overlays.map((o) => (
                    <div key={o.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input value={o.text} onChange={(e) => updateOverlay(o.id, { text: e.target.value })} />
                        <input type="color" value={o.color} onChange={(e) => updateOverlay(o.id, { color: e.target.value })} className="h-9 w-10 rounded border border-border" />
                        <Button size="icon" variant="ghost" onClick={() => removeOverlay(o.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <Label className="text-xs">X {o.x}%</Label>
                          <Slider value={[o.x]} min={0} max={100} onValueChange={(v) => updateOverlay(o.id, { x: v[0] })} />
                        </div>
                        <div>
                          <Label className="text-xs">Y {o.y}%</Label>
                          <Slider value={[o.y]} min={0} max={100} onValueChange={(v) => updateOverlay(o.id, { y: v[0] })} />
                        </div>
                        <div>
                          <Label className="text-xs">Size {o.size}px</Label>
                          <Slider value={[o.size]} min={16} max={160} onValueChange={(v) => updateOverlay(o.id, { size: v[0] })} />
                        </div>
                        <div>
                          <Label className="text-xs">Time {o.start.toFixed(1)}s – {o.end.toFixed(1)}s</Label>
                          <Slider value={[o.start, o.end]} min={0} max={duration || 1} step={0.1}
                            onValueChange={(v) => updateOverlay(o.id, { start: v[0], end: v[1] })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Source</h3>
              </div>
              <p className="text-xs text-muted-foreground truncate">{videoName}</p>
              <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => { setVideoUrl(null); setOverlays([]); }}>
                Replace video
              </Button>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 mb-3">
                <Music className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Background music</h3>
              </div>
              <label className="text-xs text-primary underline cursor-pointer">
                {audioUrl ? "Change music track" : "Upload MP3 / audio"}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAudioFile(f); }} />
              </label>
              {audioUrl && (
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-xs">Music volume {Math.round(audioVolume * 100)}%</Label>
                    <Slider value={[audioVolume]} min={0} max={1} step={0.05} onValueChange={(v) => setAudioVolume(v[0])} />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setAudioUrl(null)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              )}
              <div className="mt-4">
                <Label className="text-xs">Original volume {Math.round(videoVolume * 100)}%</Label>
                <Slider value={[videoVolume]} min={0} max={1} step={0.05} onValueChange={(v) => setVideoVolume(v[0])} />
              </div>
            </Panel>

            <Panel>
              <Button className="w-full" onClick={exportVideo} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {exporting ? "Rendering..." : "Export video (.webm)"}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Renders in real-time in your browser. Keep this tab active during export.
              </p>
            </Panel>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
