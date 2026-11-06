// Client-safe AI model lists shared by the AI Generator, Smart Chat and tests.

export const IMAGE_MODELS = [
  { id: "google/gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image" },
  { id: "google/gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash Lite Image" },
] as const;

export const VIDEO_MODELS = [
  { id: "google/veo-3.1-fast", label: "Veo 3.1 Fast" },
  { id: "google/veo-3.1", label: "Veo 3.1" },
  { id: "google/veo-3.1-lite", label: "Veo 3.1 Lite" },
] as const;

export const CHAT_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
] as const;

export const IMAGE_MODEL_IDS: readonly string[] = IMAGE_MODELS.map((m) => m.id);
export const VIDEO_MODEL_IDS: readonly string[] = VIDEO_MODELS.map((m) => m.id);
export const CHAT_MODEL_IDS: readonly string[] = CHAT_MODELS.map((m) => m.id);

export const IMAGE_ASPECTS = ["1:1", "9:16", "16:9"] as const;
export const VIDEO_ASPECTS = ["16:9", "9:16"] as const;
export const VIDEO_DURATIONS = [4, 6, 8] as const;
