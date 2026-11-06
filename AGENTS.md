# Architecture rules

- Keep MindLM as the existing retrieval/composition engine; do not introduce an external LLM into its training or answer path.
- Share contextual-query resolution between Training Studio and Offline AI, and pass completed question/answer turns from Testing / Preview so follow-up questions can retain their topic.
- Keep long-term user memory distinct from conversation history, scoped to the signed-in owner, and apply it only when relevant.