/** Browser-safe selection; long-term facts remain separate from chat history. */
export function pickRelevantMemories(
  question: string,
  memories: Array<{ kind: string; content: string }>,
  max = 3,
): Array<{ kind: string; content: string }> {
  const ignored = new Set(["hai", "hain", "the", "and", "is", "my", "mera", "meri", "ke", "ki", "ka", "hai", "है", "में", "का", "की", "के", "मेरा", "मेरी"]);
  const words = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((word) => word.length > 1 && !ignored.has(word)));
  const query = words(question);
  if (!query.size) return [];
  const asksName = /\b(my name|mera naam|mera nam)\b|मेरा नाम/i.test(question);
  const asksLanguage = /\b(language|bhasha|bhaasha)\b|भाषा/i.test(question);
  return memories.map((memory) => {
    const overlap = [...words(memory.content)].filter((word) => query.has(word)).length;
    const kindMatch = (memory.kind === "name" && asksName) || (memory.kind === "language" && asksLanguage);
    return { memory, score: overlap + (kindMatch ? 3 : 0) };
  }).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map((hit) => hit.memory);
}