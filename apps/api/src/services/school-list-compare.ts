/**
 * Admin tool: compare a pasted external school list against the schools catalog.
 * Analysis only — does not write to the database.
 */

export type CatalogSchool = {
  id: string;
  name: string;
  branch: string | null;
  locality: string | null;
  region: string | null;
  city: string;
  board_codes: string[] | null;
  grades_offered: string | null;
  normalized_key: string;
  verified: boolean;
};

export type PastedSchool = {
  line: number;
  raw: string;
  name: string;
  area: string | null;
  note: string | null;
};

export type CompareStatus =
  | "on_site"
  | "brand_elsewhere"
  | "maybe"
  | "missing";

export type CompareMatch = {
  id: string;
  name: string;
  branch: string | null;
  locality: string | null;
  region: string | null;
  city: string;
  normalizedKey: string;
  verified: boolean;
  boardCodes: string[];
  gradesOffered: string | null;
  score: number;
};

export type CompareResultRow = {
  line: number;
  raw: string;
  name: string;
  area: string | null;
  note: string | null;
  status: CompareStatus;
  score: number;
  match: CompareMatch | null;
};

const NOISE = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "school",
  "schools",
  "preschool",
  "pre",
  "daycare",
  "day",
  "care",
  "campus",
  "cbse",
  "icse",
  "ib",
  "international",
  "high",
  "primary",
  "secondary",
  "senior",
  "government",
  "govt",
  "pm",
  "shri",
  "elc",
  "by",
  "complete",
  "foundation",
  "canadian",
  "playschool",
  "montessori",
  "world",
  "boys",
  "girls",
  "vidyalaya",
  "kendriya",
  "hyderabad",
  "public",
  "global",
  "academy",
  "centre",
  "center",
  "learning",
  "early",
  "kids",
  "kinder",
  "junior",
  "juniors",
]);

/** Brand aliases: pasted name pattern → catalog name patterns */
const BRAND_ALIASES: Array<{ paste: RegExp; catalog: RegExp }> = [
  { paste: /euro\s*school|euroschool/i, catalog: /euro\s*school|euroschool/i },
  { paste: /euro\s*kids|eurokids/i, catalog: /euro\s*kids|eurokids/i },
  { paste: /chirec/i, catalog: /chirec/i },
  { paste: /goldcrest/i, catalog: /goldcrest/i },
  { paste: /kendriya|^\s*kv\b/i, catalog: /kendriya|\bkv\b/i },
  { paste: /\bnasr\b/i, catalog: /\bnasr\b/i },
  { paste: /prerana|waldorf/i, catalog: /prerana|waldorf/i },
  { paste: /ambitus/i, catalog: /ambitus/i },
  { paste: /blue\s*blocks/i, catalog: /blue\s*blocks/i },
  { paste: /phoenix\s*greens/i, catalog: /phoenix\s*greens/i },
  { paste: /avn\s*vida|\bvida\b/i, catalog: /avn\s*vida|\bvida\b/i },
  { paste: /sreenidhi/i, catalog: /sreenidhi/i },
  { paste: /chaitanya|future\s*pathways/i, catalog: /chaitanya|future\s*pathways/i },
  { paste: /\bklay\b/i, catalog: /\bklay\b/i },
  { paste: /footprint/i, catalog: /footprint/i },
  { paste: /kidzee/i, catalog: /kidzee/i },
  { paste: /maple\s*bear/i, catalog: /maple\s*bear/i },
  { paste: /firstcry|intellitots/i, catalog: /firstcry|intellitots/i },
  { paste: /ingenium/i, catalog: /ingenium/i },
  { paste: /oakridge/i, catalog: /oakridge/i },
  { paste: /delhi\s*public|\bdps\b/i, catalog: /delhi\s*public|\bdps\b/i },
];

export function tokenizeSchoolName(value: string): string[] {
  return (value || "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / new Set([...A, ...B]).size;
}

function locBlob(row: CatalogSchool): string {
  return `${row.locality || ""} ${row.branch || ""} ${row.city || ""}`.toLowerCase();
}

function areaTokens(area: string | null | undefined): string[] {
  if (!area) return [];
  return area
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 3 &&
        !["school", "phase", "colony", "nagar", "avenue", "enclave", "road", "hills"].includes(
          t
        )
    );
}

function localityMatches(
  pastedArea: string | null,
  defaultArea: string | null,
  row: CatalogSchool
): boolean {
  const loc = locBlob(row);
  const areas = [pastedArea, defaultArea].filter(Boolean) as string[];
  for (const area of areas) {
    const a = area.toLowerCase().trim();
    if (!a) continue;
    if (loc.includes(a)) return true;
    for (const tok of areaTokens(a)) {
      if (loc.includes(tok)) return true;
    }
  }
  return false;
}

function brandBoost(pastedName: string, catalogName: string): number {
  for (const { paste, catalog } of BRAND_ALIASES) {
    if (paste.test(pastedName) && catalog.test(catalogName)) return 0.55;
  }
  return 0;
}

export function scoreAgainstCatalog(
  pastedName: string,
  pastedArea: string | null,
  defaultArea: string | null,
  row: CatalogSchool
): number {
  const qt = tokenizeSchoolName(pastedName);
  const rt = tokenizeSchoolName(row.name);
  let s = jaccard(qt, rt);
  if (qt[0] && rt[0] && qt[0] === rt[0]) s += 0.25;
  if (qt.length >= 2 && rt.includes(qt[0]) && rt.includes(qt[1])) s += 0.2;
  s += brandBoost(pastedName, row.name);
  if (localityMatches(pastedArea, defaultArea, row)) s += 0.12;
  return s;
}

function stripMarkdownCell(s: string): string {
  return s.replace(/^\|+\s*|\s*\|+$/g, "").replace(/\*\*/g, "").trim();
}

/**
 * Parse free-form pasted school lists:
 * - markdown tables
 * - "1. Name — area"
 * - "Name | area | note"
 * - plain name per line
 */
export function parsePastedSchoolList(
  text: string,
  defaultArea?: string | null
): PastedSchool[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: PastedSchool[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trim();
    if (!line) continue;

    // markdown separator / alignment row
    if (
      /^\|?\s*:?-{3,}/.test(line) ||
      (line.includes("|") &&
        line
          .split("|")
          .map(stripMarkdownCell)
          .filter(Boolean)
          .every((c) => /^:?-{2,}:?$/.test(c) || /^:?-+:?$/.test(c)))
    ) {
      inTable = true;
      continue;
    }

    if (line.includes("|")) {
      const cells = line.split("|").map(stripMarkdownCell).filter(Boolean);
      // skip header-ish
      if (
        cells.length >= 2 &&
        /^(#|no|s\.?no|school|name|type|area)$/i.test(cells[0]!) &&
        /school|name|type|area/i.test(cells[1]!)
      ) {
        inTable = true;
        continue;
      }
      // skip pure alignment / empty name
      if (cells.every((c) => /^[\d.\-:\s]*$/.test(c))) continue;
      // | n | School | Type / area |
      let name = "";
      let area: string | null = null;
      let note: string | null = null;
      if (cells.length >= 3 && /^\d+$/.test(cells[0]!)) {
        name = cells[1]!;
        const rest = cells.slice(2).join(" — ");
        note = rest || null;
        area = extractAreaFromNote(rest) || defaultArea || null;
      } else if (cells.length >= 2) {
        name = cells[0]!;
        area = cells[1] || defaultArea || null;
        note = cells.slice(2).join(" — ") || null;
      }
      name = cleanName(name);
      if (name && name.length > 1) {
        out.push({ line: i + 1, raw: rawLine, name, area, note });
      }
      continue;
    }

    // numbered / bulleted
    const m = line.match(
      /^(?:\d+[.)]\s*|[-*•]\s+)(.+?)(?:\s+[—–-]\s+(.+))?$/
    );
    if (m) {
      const name = cleanName(m[1]!);
      const rest = m[2]?.trim() || null;
      if (name) {
        out.push({
          line: i + 1,
          raw: rawLine,
          name,
          area: extractAreaFromNote(rest) || defaultArea || null,
          note: rest,
        });
      }
      continue;
    }

    // Name — area
    const dash = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (dash) {
      const name = cleanName(dash[1]!);
      const rest = dash[2]!.trim();
      if (name) {
        out.push({
          line: i + 1,
          raw: rawLine,
          name,
          area: extractAreaFromNote(rest) || defaultArea || null,
          note: rest,
        });
      }
      continue;
    }

    if (inTable) continue;

    const name = cleanName(line);
    if (name && name.length > 2 && !/^summary|^status|^on site/i.test(name)) {
      out.push({
        line: i + 1,
        raw: rawLine,
        name,
        area: defaultArea || null,
        note: null,
      });
    }
  }

  return out;
}

function cleanName(name: string): string {
  return name
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAreaFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  // "CBSE school — Lumbini Avenue" or "Preschool — Telecom Nagar"
  const parts = note.split(/[—–|-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (last.length > 2 && last.length < 60) return last;
  }
  // bare locality-ish
  if (note.length < 40 && !/school|cbse|icse|govt|preschool/i.test(note)) {
    return note;
  }
  return null;
}

function toMatch(row: CatalogSchool, score: number): CompareMatch {
  return {
    id: row.id,
    name: row.name,
    branch: row.branch,
    locality: row.locality,
    region: row.region,
    city: row.city,
    normalizedKey: row.normalized_key,
    verified: row.verified,
    boardCodes: Array.isArray(row.board_codes) ? row.board_codes : [],
    gradesOffered: row.grades_offered,
    score: Math.round(score * 100) / 100,
  };
}

export function comparePastedToCatalog(
  pasted: PastedSchool[],
  catalog: CatalogSchool[],
  defaultArea?: string | null
): CompareResultRow[] {
  return pasted.map((p) => {
    let best: CatalogSchool | null = null;
    let bestScore = 0;
    for (const row of catalog) {
      const s = scoreAgainstCatalog(p.name, p.area, defaultArea ?? null, row);
      if (s > bestScore) {
        bestScore = s;
        best = row;
      }
    }

    let status: CompareStatus = "missing";
    let match: CompareMatch | null = null;

    if (best && bestScore >= 0.55) {
      match = toMatch(best, bestScore);
      const sameLoc = localityMatches(p.area, defaultArea ?? null, best);
      status = sameLoc ? "on_site" : "brand_elsewhere";
    } else if (best && bestScore >= 0.38) {
      match = toMatch(best, bestScore);
      status = "maybe";
    }

    return {
      line: p.line,
      raw: p.raw,
      name: p.name,
      area: p.area,
      note: p.note,
      status,
      score: Math.round(bestScore * 100) / 100,
      match,
    };
  });
}

export function summarizeCompare(rows: CompareResultRow[]) {
  const counts: Record<CompareStatus, number> = {
    on_site: 0,
    brand_elsewhere: 0,
    maybe: 0,
    missing: 0,
  };
  for (const r of rows) counts[r.status]++;
  return {
    total: rows.length,
    ...counts,
  };
}
