# Smart Growth — Next Feature Batch

Bahut saare features hain. Main inhe 7 clear tasks mein todunga. Approve karo toh ek-ek karke build karta hoon.

## 1. YouTube Analyzer — Login-first flow
- `/analyzer` khulte hi pehle **"Sign in with Google (YouTube)"** screen dikhega.
- Google OAuth ke saath YouTube read-only scope (`youtube.readonly`) maangenge — user apne YouTube channel wali email se login karega.
- Login ke baad `channels?mine=true` se auto channel fetch → AI analysis + growth ideas (existing `analyzer.functions.ts` reuse).
- Agar user chahe toh manual URL input bhi rahega (fallback).

**Technical:** Supabase ke Google provider mein YouTube scope add karna hoga (managed OAuth mein scope customization limited hai — agar block ho toh separate Google OAuth app + token exchange edge function banayenge; user ko batayenge).

## 2. Chat — Copy button on AI messages
- Har AI message ke top-right corner mein ek chhota **Copy** icon.
- Click → text clipboard mein → "Copied" toast.
- Chat.tsx aur content-studio chat dono jagah.

## 3. Video Generator — 1 video at a time
- `/video` page: parallel 2 → **sirf 1 video** generate hogi.
- Loading state saaf, retry button.
- Video generator ka entry point **har relevant tool page** (Content Studio, Chat, YouTube tools) mein "Generate Video" button ke roop mein add.

## 4. Image Generator — 2 images (was 4)
- `/image` page mein `Promise.all` 4 → **2** kar denge.
- Streaming UX same rahega.

## 5. Home page — Sidebar features inline
- Jo bhi links "3-line" (hamburger) menu mein hain, unhe **home page** par card grid ke roop mein bhi dikhayenge (Content Studio, Chat, Image, Video, Analyzer, Voice, Learn, etc.).
- Mobile-first grid, smooth hover.

## 6. AI Voice (TTS) — New feature
- Naya route: `/voice`.
- User apni script paste kare → **10 voices** ka grid (OpenAI `gpt-4o-mini-tts` ki 10 voices: alloy, echo, fable, onyx, nova, shimmer, coral, verse, ballad, ash).
- Voice select → **Generate** → screen par **live % progress** (SSE stream ke chunks se calculate).
- Progress: 5% → 10% → 50% → 100%, complete hote hi audio player.

**Credits:**
- Har user ko **10 credits/day** (naya table `voice_credits`: user_id, date, used).
- 1 credit = 3 sec audio, max **30 sec** per generation (10 credits din bhar).
- Limit khatam → "Upgrade" CTA (abhi ke liye disabled/coming soon).

## 7. Scoped chat + Creator identity
- **Scoped chat**: har tool ka chat sirf uske domain ka jawab de.
  - Content Studio chat → sirf content queries.
  - Business learn → sirf business.
  - Off-topic → polite refuse: "Yeh chat sirf [X] ke liye hai."
  - System prompt me strict scope + refusal instruction.
- **Creator identity**: agar user pooche "tumhe kisne banaya" / "who made you" →
  > "Main 28 tareek 2026, chhathvein mahine banaya gaya hoon. Mera kaam Smart Growth ko sambhalna hai."
  System prompt mein baked.
- **In-chat image generation**: chat mein `/image <prompt>` ya "generate image of…" detect → server-side image tool call → image inline render.

---

## Files (approx)
- **Edit**: `src/routes/_authenticated/analyzer.tsx` (login gate), `chat.tsx` (copy btn, scope, image tool), `content-studio.tsx` (copy btn, scope), `video.tsx` (1 video), `image.tsx` (2 images), `index.tsx` (feature grid), `app-shell.tsx` (voice link).
- **New**: `src/routes/_authenticated/voice.tsx`, `src/lib/voice.functions.ts`, `src/routes/api/tts.ts` (SSE stream), migration for `voice_credits` table + RLS.
- **Supabase**: Google OAuth scope config (may need user action if managed OAuth blocks it).

## Order
1 → 2 → 4 → 3 → 5 → 7 → 6 (Voice last — biggest).

**Approve karo toh shuru karun? Ya kisi step mein change chahiye?**
