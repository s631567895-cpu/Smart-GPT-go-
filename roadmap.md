# Roadmap

## In progress — Memory System + AI upgrades (Suresh, Nov 1 2026)
- [x] Context Memory module (src/lib/context-memory.ts) — resolves "isse aur batao"-type questions from conversation history
- [x] User Memory table + server functions + Profile UI (long-term facts, used only when relevant)
- [x] MindLM: folder + trained-index retrieval and extractive composition integrated (not a generative LLM)
- [x] askMyModel accepts history; Testing / Preview sends completed turns; signed-in follow-up verified
- [x] api/chat.ts injects relevant User Memory using the shared selector (live AI response not exercised in this check)
- [x] Offline page passes recent history to the shared context resolver (offline transport not exercised in this check)
- [x] YouTube Analyzer → "This feature is private." card
- [x] Old Agent Mind /mind and /agent routes removed; Training Studio preserved
- [x] Homepage: chatbot ~370px under hero; four feature cards verified
- [x] Offline typing errors cleared
- [x] Preview build OK; seven memory tests passed; memory persistence and delete verified with temporary test row

## Later
- MindLM retrain needed after engine changes (owner action in Training Studio)
## In progress — AI Generator + Smart Chat Gemini (Suresh, Nov 6 2026)
- [ ] Replace Build landing and remove Website/App builder entry points with AI Generator for text/image/video modes
- [ ] Add authenticated generation history and secure Google AI image/video generation with model selection and Auto behavior
- [ ] Add Gemini model selection and limited transient-error fallback to Smart Chat without masking authentication/request errors
- [ ] Verify preview flows, tests, and build diagnostics
