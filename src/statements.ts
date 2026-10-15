import type { Source, Statement } from "./types.ts";

export function extractStatements(sources: Source[]): Statement[] {
  return sources.flatMap((source) => {
    if (source.aliasOf) return [];
    if (!source.body) return [];
    return splitStatements(source.body).map((item) => ({
      path: source.path,
      line: item.line,
      text: item.text,
      layer: source.layer,
      activation: source.activation,
      specificity: source.specificity,
      appliesUnder: source.appliesUnder,
      kind: source.kind,
    }));
  });
}

function splitStatements(text: string): { line: number; text: string }[] {
  const lines = text.split(/\r?\n/);
  const statements: { line: number; text: string }[] = [];
  let paragraph: string[] = [];
  let paragraphStart = 1;

  function flush(): void {
    const value = normalizeStatement(paragraph.join(" "));
    if (isStatement(value)) statements.push({ line: paragraphStart, text: value });
    paragraph = [];
  }

  for (const [index, raw] of lines.entries()) {
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line || isSkippable(line)) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.*)/) ?? line.match(/^\d+\.\s+(.*)/);
    if (bullet) {
      flush();
      const value = normalizeStatement(bullet[1] ?? "");
      if (isStatement(value)) statements.push({ line: lineNumber, text: value });
      continue;
    }
    if (paragraph.length === 0) paragraphStart = lineNumber;
    paragraph.push(line);
  }
  flush();
  return statements;
}

function isSkippable(line: string): boolean {
  return line.startsWith("#") || line.startsWith("```") || line.startsWith(">") || line === "---" || line.startsWith("|");
}

function normalizeStatement(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
}

function isStatement(value: string): boolean {
  return value.length >= 12;
}
