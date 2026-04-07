/**
 * Client-side fuzzy search for vault items.
 *
 * Supports:
 * - Fuzzy substring matching with relevance scoring.
 * - Field-specific prefixed queries: `user:john`, `url:github`, `title:bank`.
 * - Results capped at top 10 by relevance score.
 * - Falls back to exact `includes()` for very short queries (< 3 chars).
 */

import type { VaultViewItem } from "../features/vault/vault.types";

// ── Fuzzy match engine ──────────────────────────────────────────────────────

interface FuzzyResult {
  matches: boolean;
  score: number;
}

/**
 * Fuzzy-match a query against a target string.
 * Returns a score where higher = better match.
 *
 * Scoring:
 * - Exact match:              +100
 * - Starts with query:        +50
 * - Contains query (exact):   +30
 * - Fuzzy character sequence: +1 per matched char, bonus for consecutive
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult {
  if (!query || !target) return { matches: false, score: 0 };

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return { matches: true, score: 100 };

  // Starts with
  if (t.startsWith(q)) return { matches: true, score: 50 + q.length };

  // Contains (substring)
  if (t.includes(q)) return { matches: true, score: 30 + q.length };

  // Fuzzy: every character in query must appear in target in order
  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      // Bonus for consecutive character matches
      score += 1 + consecutive;
    } else {
      consecutive = 0;
    }
  }

  if (qi === q.length) {
    return { matches: true, score };
  }

  return { matches: false, score: 0 };
}

// ── Field-specific search ───────────────────────────────────────────────────

const FIELD_PREFIXES: Record<string, string[]> = {
  "user:":  ["username"],
  "url:":   ["url"],
  "title:": ["title"],
  "note:":  ["notes"],
  "tag:":   ["tags"],
  "bank:":  ["bankName"],
  "card:":  ["cardholderName"],
};

interface SearchableFields {
  title?: string;
  username?: string;
  url?: string;
  notes?: string;
  cardholderName?: string;
  bankName?: string;
  tags?: string[];
}

function getFieldValue(secret: SearchableFields, field: string): string {
  switch (field) {
    case "username": return (secret as any).username ?? "";
    case "url": return (secret as any).url ?? "";
    case "title": return secret.title ?? "";
    case "notes": return (secret as any).notes ?? "";
    case "bankName": return (secret as any).bankName ?? "";
    case "cardholderName": return (secret as any).cardholderName ?? "";
    case "tags": return (secret.tags ?? []).join(" ");
    default: return "";
  }
}

/**
 * All searchable text fields on a vault item, with weights.
 * Higher weight = this field contributes more to relevance.
 */
const SEARCH_FIELDS: { field: string; weight: number }[] = [
  { field: "title",          weight: 3 },
  { field: "username",       weight: 2 },
  { field: "url",            weight: 2 },
  { field: "bankName",       weight: 2 },
  { field: "cardholderName", weight: 2 },
  { field: "notes",          weight: 1 },
  { field: "tags",           weight: 1.5 },
];

/** Maximum number of results returned from a fuzzy search. */
const MAX_RESULTS = 10;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Search vault items with fuzzy matching and optional field-specific prefixes.
 *
 * Examples:
 * - `"github"`        → fuzzy search across all fields
 * - `"user:john"`     → search only the username field for "john"
 * - `"url:git"`       → search only the url field for "git"
 *
 * Returns the top 10 results sorted by relevance score (descending).
 */
export function searchVaultItems(
  query: string,
  items: VaultViewItem[],
): VaultViewItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  // Check for field-specific prefix
  let targetFields: string[] | null = null;
  let searchQuery = trimmed;

  for (const [prefix, fields] of Object.entries(FIELD_PREFIXES)) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      targetFields = fields;
      searchQuery = trimmed.slice(prefix.length).trim();
      break;
    }
  }

  if (!searchQuery) return items;

  // For very short queries (< 3 chars), use exact substring match
  const useExact = searchQuery.length < 3;

  const scored: { item: VaultViewItem; score: number }[] = [];

  for (const item of items) {
    const secret = item.secret;
    if (!secret) continue;

    let bestScore = 0;
    const fields = targetFields
      ? targetFields.map(f => ({ field: f, weight: 2 }))
      : SEARCH_FIELDS;

    for (const { field, weight } of fields) {
      const value = getFieldValue(secret as SearchableFields, field);
      if (!value) continue;

      if (useExact) {
        if (value.toLowerCase().includes(searchQuery.toLowerCase())) {
          bestScore = Math.max(bestScore, 30 * weight);
        }
      } else {
        const result = fuzzyMatch(searchQuery, value);
        if (result.matches) {
          bestScore = Math.max(bestScore, result.score * weight);
        }
      }
    }

    if (bestScore > 0) {
      scored.push({ item, score: bestScore });
    }
  }

  // Sort by score descending, cap at MAX_RESULTS
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS).map(s => s.item);
}
