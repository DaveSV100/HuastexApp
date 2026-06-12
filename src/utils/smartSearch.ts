// src/utils/smartSearch.ts
// Keyword product search ported from the web's Inventory page
// (client/src/pages/Inventory/index.jsx) so both ends match the same way:
// accent- and case-insensitive, and every typed word must appear somewhere
// in the text, in any order — "hisense 18 pies refrigerador" still finds
// "Refrigerador Hisense 18 Pies".

/** Lowercase + strip accents ("Pérez" → "perez"). */
export function normalizeSearchText(value: unknown): string {
  const s = String(value ?? '');
  try {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

/** True when every word of `query` appears in `text` (any order). */
export function matchesAllKeywords(text: unknown, query: unknown): boolean {
  const haystack = normalizeSearchText(text);
  const keywords = normalizeSearchText(query).split(' ').filter(Boolean);
  return keywords.every(keyword => haystack.includes(keyword));
}
