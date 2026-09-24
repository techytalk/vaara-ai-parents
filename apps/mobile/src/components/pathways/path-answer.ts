export type PathAnswerBlock =
  | { kind: "lead"; text: string }
  | { kind: "text"; text: string }
  | { kind: "checks"; title: string | null; items: string[] }
  | {
      kind: "compare";
      leftTitle: string;
      rightTitle: string;
      rows: { muted: boolean; left: string; right: string }[];
    }
  | { kind: "callout"; tone: "example" | "note" | "ask"; kicker: string; text: string }
  | { kind: "facts"; items: { value: string; unit: string; caption: string }[] }
  | { kind: "pair"; items: { title: string; body: string }[] }
  | { kind: "steps"; items: { title: string; body: string }[] }
  | { kind: "more"; title: string; body: string }
  | { kind: "tiles" };

function splitCells(line: string): string[] {
  return line.split("|").map((cell) => cell.trim());
}

function parseChecks(body: string): { title: string | null; items: string[] } {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: string[] = [];
  const titleLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      items.push(line.replace(/^[-•]\s+/, ""));
    } else if (items.length === 0) {
      titleLines.push(line);
    } else {
      items.push(line);
    }
  }
  return { title: titleLines.join(" ") || null, items };
}

function parseCompare(body: string): PathAnswerBlock | null {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const headers = splitCells(lines[0]);
  if (headers.length < 2) return null;
  const rows = lines.slice(1).map((line) => {
    const muted = line.startsWith("#");
    const cells = splitCells(muted ? line.slice(1).trim() : line);
    return { muted, left: cells[0] ?? "", right: cells[1] ?? "" };
  });
  return {
    kind: "compare",
    leftTitle: headers[0],
    rightTitle: headers[1],
    rows,
  };
}

function parseCallout(
  tone: "example" | "note" | "ask",
  fallbackKicker: string,
  body: string
): PathAnswerBlock {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return { kind: "callout", tone, kicker: fallbackKicker, text: lines[0] ?? "" };
  }
  return { kind: "callout", tone, kicker: lines[0], text: lines.slice(1).join("\n") };
}

/** Turns an authored lead into visual blocks. Plain text stays plain. */
export function parsePathAnswer(source: string | null | undefined): PathAnswerBlock[] | null {
  if (!source || !source.includes("[[")) return null;
  const parts = source.split(/^\s*\[\[([^\]]+)\]\]\s*$/m);
  const blocks: PathAnswerBlock[] = [];
  const preamble = parts[0]?.trim();
  if (preamble) blocks.push({ kind: "text", text: preamble });

  for (let i = 1; i < parts.length; i += 2) {
    const tag = parts[i].trim().toLowerCase();
    const body = (parts[i + 1] ?? "").trim();
    if (tag === "view tiles" || tag === "tiles") {
      blocks.push({ kind: "tiles" });
      continue;
    }
    if (!body && tag !== "view tiles") continue;
    if (tag === "lead") blocks.push({ kind: "lead", text: body });
    else if (tag === "text") blocks.push({ kind: "text", text: body });
    else if (tag === "checks") {
      const checks = parseChecks(body);
      if (checks.items.length > 0) blocks.push({ kind: "checks", ...checks });
    } else if (tag === "compare") {
      const compare = parseCompare(body);
      if (compare) blocks.push(compare);
    } else if (tag === "example") {
      blocks.push(parseCallout("example", "FOR EXAMPLE", body));
    } else if (tag === "note" || tag === "plan") {
      blocks.push(parseCallout("note", "NOTE", body));
    } else if (tag === "ask-school" || tag === "ask school") {
      blocks.push(parseCallout("ask", "ASK SCHOOL", body));
    } else if (tag === "facts") {
      const items = body
        .split("\n")
        .map((line) => splitCells(line.trim()))
        .filter((cells) => cells.length >= 3 && cells[0])
        .map((cells) => ({ value: cells[0], unit: cells[1], caption: cells[2] }));
      if (items.length > 0) blocks.push({ kind: "facts", items });
    } else if (tag === "pair") {
      const items = body
        .split("\n")
        .map((line) => splitCells(line.trim()))
        .filter((cells) => cells.length >= 2 && cells[0])
        .map((cells) => ({ title: cells[0], body: cells.slice(1).join(" ") }));
      if (items.length > 0) blocks.push({ kind: "pair", items });
    } else if (tag === "steps") {
      const items = body
        .split("\n")
        .map((line) => splitCells(line.trim()))
        .filter((cells) => cells.length >= 2 && cells[0])
        .map((cells) => ({ title: cells[0], body: cells.slice(1).join(" ") }));
      if (items.length > 0) blocks.push({ kind: "steps", items });
    } else if (tag === "more") {
      const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length >= 2) {
        blocks.push({ kind: "more", title: lines[0], body: lines.slice(1).join("\n") });
      }
    }
  }

  return blocks.length > 0 ? blocks : null;
}

export function answerOpensAsPage(lead: string | null | undefined): boolean {
  return parsePathAnswer(lead) != null;
}
