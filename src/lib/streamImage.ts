import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

type Payload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string } };

export async function streamImage(
  body: { prompt: string; aspect: string; style: string },
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${t.slice(0, 200)}`);
  }

  let finalUrl = "";
  let streamError = "";
  const parser = createParser({
    onEvent(event) {
      let payload: Payload | undefined;
      try { payload = JSON.parse(event.data) as Payload; } catch { return; }
      if (event.event === "error" || payload?.type === "error") {
        streamError = (payload as { error?: { message?: string } })?.error?.message ?? "Image generation failed";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      ) return;
      const b64 = (payload as { b64_json?: string }).b64_json;
      if (!b64) return;
      const dataUrl = `data:image/png;base64,${b64}`;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => onFrame(dataUrl, isFinal));
      if (isFinal) finalUrl = dataUrl;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!finalUrl) throw new Error("Stream ended without final image");
  return finalUrl;
}
