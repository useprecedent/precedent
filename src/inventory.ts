import { lstatSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { redact } from "./redact.ts";
import type { ExtraRule, Inventory, Kind, Source } from "./types.ts";

export const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".venv",
  ".astro",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "venv",
]);

const BODY_LIMIT = 30_000;
const FILE_LIMIT = 200_000;
const DOCUMENT_NAMES = new Set(["AGENTS.md", "CLAUDE.md"]);

type Frontmatter = Record<string, unknown>;

export function collectInventory(options: {
  root: string;
  home: string;
  includeUserRules: boolean;
  includeAncestors: boolean;
  extraRules: ExtraRule[];
}): Inventory {
  const root = realpath(options.root);
  const home = realpath(options.home);
  const records = new Map<string, Source>();

  for (const path of walkInstructionFiles(root))
    records.set(location(path), sourceRecord(path, root, "project"));

  if (options.includeAncestors)
    for (const directory of ancestorDirs(root, home))
      for (const name of DOCUMENT_NAMES) {
        const path = join(directory, name);
        const placed = location(path);
        if (isFile(path) && !records.has(placed))
          records.set(placed, sourceRecord(path, root, "project"));
      }

  if (options.includeUserRules) {
    const userRules = join(home, ".cursor", "rules");
    if (isDir(userRules))
      for (const path of walkMdc(userRules)) {
        const placed = location(path);
        if (records.has(placed) || skipped(path)) continue;
        records.set(placed, { ...sourceRecord(path, root, "user"), kind: "user-rule", layer: "user" });
      }
  }

  for (const [index, extra] of options.extraRules.entries()) {
    const path = extra.layer === "team" ? `cursor://team/${index + 1}` : `cursor://user/${index + 1}`;
    records.set(path, {
      path: extra.title,
      kind: extra.layer === "team" ? "team-rule" : "user-rule",
      layer: extra.layer,
      activation: "always",
      specificity: 0,
      appliesUnder: null,
      description: extra.title,
      globs: [],
      body: extra.text,
    });
  }

  return {
    root,
    sources: [...records.values()].sort(sortSources),
    missingFromDisk: ["team rules", "user rules stored in Cursor settings"],
  };
}

function walkInstructionFiles(root: string): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }
      if (DOCUMENT_NAMES.has(entry.name)) found.push(abs);
    }
  }
  const rules = join(root, ".cursor", "rules");
  if (isDir(rules)) found.push(...walkMdc(rules).filter((path) => !skipped(path)));
  return found;
}

function walkMdc(dir: string): string[] {
  const found: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }
      if (entry.name.endsWith(".mdc")) found.push(abs);
    }
  }
  return found.sort();
}

function ancestorDirs(root: string, home: string): string[] {
  const dirs: string[] = [];
  let current = dirname(root);
  while (current !== dirname(current) && dirs.length < 8) {
    dirs.push(current);
    if (current === home) break;
    current = dirname(current);
  }
  return dirs;
}

function skipped(path: string): boolean {
  return path.split(sep).some((part) => SKIP_DIRS.has(part));
}

function sourceRecord(path: string, root: string, layer: Source["layer"]): Source {
  const kind = kindFor(path);
  const text = readText(path);
  const { meta, body } = text === null ? { meta: {} as Frontmatter, body: "" } : splitFrontmatter(text);
  const { activation, globs } = classify(meta, kind);
  const description = typeof meta.description === "string" && meta.description ? meta.description : null;
  const record: Source = {
    path: displayPath(path, root),
    kind,
    layer,
    activation,
    specificity: specificityFor(path, root, kind),
    appliesUnder: appliesUnder(path, root, kind),
    description,
    globs,
  };
  if (isSymlink(path)) record.aliasOf = readlinkSync(path);
  if (text === null) {
    record.bodyOmittedReason = "unreadable";
    return record;
  }
  if (activation !== "always") return record;
  if (body.length > BODY_LIMIT) {
    record.body = redact(body.slice(0, BODY_LIMIT));
    record.bodyTruncated = true;
    return record;
  }
  record.body = redact(body);
  return record;
}

function kindFor(path: string): Kind {
  const name = basename(path);
  if (name === "AGENTS.md") return "agents-md";
  if (name === "CLAUDE.md") return "claude-md";
  return "project-rule";
}

function readText(path: string): string | null {
  try {
    if (statSync(path).size > FILE_LIMIT) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function splitFrontmatter(text: string): { meta: Frontmatter; body: string } {
  const lines = splitLines(text);
  if (!lines[0] || lines[0].trim() !== "---") return { meta: {}, body: text };
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "---") continue;
    return {
      meta: parseFrontmatter(lines.slice(1, index).join("\n")),
      body: lines.slice(index + 1).join("\n").replace(/^\n+/, ""),
    };
  }
  return { meta: {}, body: text };
}

function parseFrontmatter(block: string): Frontmatter {
  const parsed: Frontmatter = {};
  const lines = block.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim() || line.trimStart().startsWith("#") || !line.includes(":")) {
      index += 1;
      continue;
    }
    const cut = line.indexOf(":");
    const key = line.slice(0, cut).trim();
    const raw = line.slice(cut + 1).trim();
    if (raw === ">" || raw === ">-" || raw === "|" || raw === "|-") {
      index += 1;
      const folded: string[] = [];
      while (index < lines.length && (lines[index]?.startsWith(" ") || lines[index]?.startsWith("\t") || lines[index]?.trim() === "")) {
        if (lines[index]?.trim() === "") break;
        folded.push((lines[index] ?? "").trim());
        index += 1;
      }
      parsed[key] = folded.join(" ");
      continue;
    }
    if (raw === "") {
      index += 1;
      const items: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trimStart().startsWith("- ")) {
        items.push(unquote((lines[index] ?? "").trimStart().slice(2).trim()));
        index += 1;
      }
      if (items.length > 0) parsed[key] = items;
      continue;
    }
    parsed[key] = coerce(raw);
    index += 1;
  }
  return parsed;
}

function classify(meta: Frontmatter, kind: Kind): { activation: Source["activation"]; globs: string[] } {
  if (kind === "agents-md" || kind === "claude-md") return { activation: "always", globs: [] };
  const globs = normalizeGlobs(meta.globs);
  if (meta.alwaysApply === true) return { activation: "always", globs };
  if (globs.length > 0) return { activation: "glob", globs };
  if (typeof meta.description === "string" && meta.description.trim())
    return { activation: "intelligent", globs: [] };
  return { activation: "manual", globs: [] };
}

function normalizeGlobs(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((part) => unquote(part.trim())).filter(Boolean);
    }
    return trimmed.split(",").map((part) => unquote(part.trim())).filter(Boolean);
  }
  return [];
}

function coerce(raw: string): unknown {
  if (raw.startsWith("[") && raw.endsWith("]")) return normalizeGlobs(raw);
  const lowered = raw.toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  return unquote(raw);
}

function unquote(value: string): string {
  if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'"))
    return value.slice(1, -1);
  return value;
}

function location(path: string): string {
  return join(realpath(dirname(path)), basename(path));
}

function realpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function specificityFor(path: string, root: string, kind: Kind): number {
  if (kind !== "agents-md" && kind !== "claude-md") return 0;
  const parent = dirname(location(path));
  const rel = relative(root, parent);
  if (rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep)))
    return rel === "" ? 0 : rel.split(sep).filter(Boolean).length;
  return -relative(parent, root).split(sep).filter(Boolean).length;
}

function appliesUnder(path: string, root: string, kind: Kind): string | null {
  if (kind !== "agents-md" && kind !== "claude-md") return null;
  const parent = dirname(location(path));
  const rel = relative(root, parent);
  if (rel.startsWith("..") || rel.startsWith(sep)) return null;
  return rel === "" ? null : rel.split(sep).join("/");
}

function displayPath(path: string, root: string): string {
  const placed = location(path);
  const rel = relative(root, placed);
  if (rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep))) return rel.split(sep).join("/");
  return placed;
}

function sortSources(a: Source, b: Source): number {
  const layerRank = (layer: Source["layer"]) => (layer === "project" ? 0 : 1);
  if (layerRank(a.layer) !== layerRank(b.layer)) return layerRank(a.layer) - layerRank(b.layer);
  if (a.specificity !== b.specificity) return b.specificity - a.specificity;
  return a.path.localeCompare(b.path);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function defaultHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}
