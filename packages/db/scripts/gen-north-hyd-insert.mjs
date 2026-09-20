import { spawnSync } from "child_process";
import { writeFileSync } from "fs";

const XLSX =
  "/Users/anushareddybhairy/Downloads/vaara/North_Hyderabad_15_Belts_All_Schools_Duplicates_Highlighted.xlsx";
const OUT =
  "/Users/anushareddybhairy/vaara parents/packages/db/scripts/seed_north_hyderabad_schools.sql";

function extractXml(inner) {
  return spawnSync("unzip", ["-p", XLSX, inner], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  }).stdout;
}
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}
function parseSharedStrings(xml) {
  const strings = [];
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) || [];
  for (const item of items) {
    const texts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
      decode(m[1])
    );
    strings.push(texts.join(""));
  }
  return strings;
}
function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function normalizeSchoolPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
function firstPart(value) {
  if (!value) return "";
  return value.split("|")[0].trim();
}
function mapBoards(raw) {
  const t = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return [];
  if (/verify/.test(t) && !/legacy/.test(t)) return [];
  const codes = [];
  if (/\bcbse\b/.test(t)) codes.push("CBSE");
  if (/\bssc\b/.test(t) || /telangana state board/.test(t) || /^state board$/.test(t))
    codes.push("SSC");
  if (/cambridge|igcse/.test(t)) codes.push("IGCSE");
  return [...new Set(codes)];
}
function isJuniorCollege(name, board, type) {
  const t = `${name} ${board} ${type}`.toLowerCase();
  return /junior college|\bjr\.?\s*college|kalashala|voc jr|college of commerce|\bjr college/.test(
    t
  );
}
function isPlaceholder(name) {
  return /^local preschool\/daycare centres$/i.test(name.trim());
}
function isPreschool(name, type, board, classes) {
  const t = `${name} ${type} ${board} ${classes}`.toLowerCase();
  if (/high school|senior secondary|techno school/.test(t) && !/preschool|play school|daycare|pre-primary|pre primary/.test(type + " " + board)) {
    return false;
  }
  return /preschool|pre-school|pre school|playschool|play school|playway|daycare|day care|pre-primary|pre primary|montessori|kidzee|eurokids|bachpan|hello kids|time kids|makoons|little millennium/.test(
    t
  );
}
function pinFrom(address) {
  const m = String(address || "").match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

const sst = parseSharedStrings(extractXml("xl/sharedStrings.xml"));
const xml = extractXml("xl/worksheets/sheet1.xml");
const rows = [];
const rowRe = /<row[^>]* r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
let m;
while ((m = rowRe.exec(xml))) {
  if (Number(m[1]) === 1) continue;
  const cells = [];
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
  let c;
  while ((c = cellRe.exec(m[2]))) {
    const col = colToIndex(c[1]);
    const attrs = c[3];
    const inner = c[4];
    let val = "";
    const v = inner.match(/<v>([\s\S]*?)<\/v>/);
    const is = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
    if (attrs.includes('t="s"') && v) val = sst[Number(v[1])] ?? "";
    else if (attrs.includes('t="inlineStr"') && is) val = decode(is[1]);
    else if (v) val = v[1];
    cells[col] = val;
  }
  rows.push({
    belt: (cells[0] || "").trim(),
    name: (cells[1] || "").trim(),
    area: (cells[2] || "").trim(),
    type: (cells[4] || "").trim(),
    management: (cells[5] || "").trim(),
    board: (cells[6] || "").trim(),
    classes: (cells[8] || "").trim(),
    location: (cells[10] || "").trim(),
    address: (cells[11] || "").trim(),
  });
}

const skipGov = /^(government|government\/local body|telangana government|government\/residential)$/i;
const seen = new Map();
const out = [];
const skipped = { empty: 0, placeholder: 0, college: 0, gov: 0, dupBelt: 0 };

for (const r of rows) {
  if (!r.name) {
    skipped.empty++;
    continue;
  }
  if (isPlaceholder(r.name)) {
    skipped.placeholder++;
    continue;
  }
  if (isJuniorCollege(r.name, r.board, r.type)) {
    skipped.college++;
    continue;
  }
  const mgmt = r.management.split("|")[0].trim();
  if (skipGov.test(mgmt)) {
    skipped.gov++;
    continue;
  }

  const locality = r.belt;
  const branch = firstPart(r.area) || firstPart(r.location) || locality;
  const city = "Hyderabad";
  const preschool = isPreschool(r.name, r.type, r.board, r.classes);
  const key = `${normalizeSchoolPart(r.name)}|${normalizeSchoolPart(branch)}|${normalizeSchoolPart(city)}`;
  const dedupe = `${normalizeSchoolPart(r.name)}||${normalizeSchoolPart(locality)}`;
  if (seen.has(dedupe) || seen.has(key)) {
    skipped.dupBelt++;
    continue;
  }
  seen.set(dedupe, true);
  seen.set(key, true);

  const boards = mapBoards(r.board);
  const pin = pinFrom(r.address);
  out.push({
    name: r.name.replace(/\s+/g, " ").trim(),
    branch,
    locality,
    city,
    pin,
    key,
    kind: preschool ? "preschool" : "school",
    offers: preschool,
    boards,
  });
}

const values = out.map((s) => {
  const boardSql =
    s.boards.length === 0
      ? "'{}'::text[]"
      : `'{${s.boards.join(",")}}'::text[]`;
  const pinSql = s.pin ? sqlStr(s.pin) : "NULL";
  return `  (
    ${sqlStr(s.name)},
    ${sqlStr(s.branch)},
    ${sqlStr(s.locality)},
    ${sqlStr(s.city)},
    'Telangana',
    ${pinSql},
    'north-hyderabad',
    ${sqlStr(s.key)},
    true, now(), 'north-hyd-15-belts',
    '${s.kind}',
    ${s.offers},
    ${boardSql}
  )`;
});

const sql = `-- North Hyderabad 15-belt private/directory campuses.
-- Source: North_Hyderabad_15_Belts_All_Schools_Duplicates_Highlighted.xlsx
-- Skipped: empty rows, junior colleges, government management, placeholder daycare rows,
-- and same-name duplicates within one belt.
-- Parents still pick curriculum/grade. Phone/email/website/UDISE are not stored.
-- ${out.length} rows. Safe to re-run.

INSERT INTO schools (
  name, branch, locality, city, state, pin_code, region,
  normalized_key, verified, verified_at, verified_by,
  kind, offers_preschool, board_codes
) VALUES
${values.join(",\n")}
ON CONFLICT (normalized_key) DO UPDATE SET
  name = EXCLUDED.name,
  branch = EXCLUDED.branch,
  locality = EXCLUDED.locality,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  pin_code = COALESCE(EXCLUDED.pin_code, schools.pin_code),
  region = EXCLUDED.region,
  verified = true,
  verified_at = COALESCE(schools.verified_at, EXCLUDED.verified_at),
  kind = EXCLUDED.kind,
  offers_preschool = EXCLUDED.offers_preschool,
  board_codes = EXCLUDED.board_codes,
  updated_at = now();
`;

writeFileSync(OUT, sql);
console.log(
  JSON.stringify(
    {
      inserted: out.length,
      skipped,
      preschool: out.filter((s) => s.kind === "preschool").length,
      withBoard: out.filter((s) => s.boards.length > 0).length,
      withPin: out.filter((s) => s.pin).length,
      out: OUT,
    },
    null,
    2
  )
);
