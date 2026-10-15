import { lstatSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import {
  CONFIG_DIR_NAMES,
  DOCUMENT_NAMES,
  ecosystemsFor,
  isCursorPluginRulePath,
  isRuleFileName,
  kindFor as kindFromPath,
} from "./ecosystems.ts";
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

type Frontmatter = Record<string, unknown>;

export const MISSING_FROM_DISK = [
  "team rules",
  "user rules stored in Cursor settings",
  "Copilot personal and organization instructions (GitHub UI)",
  "Claude Code managed settings",
  "Cursor marketplace plugins (enabled set is not on disk)",
];

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
    records.set(location(path), sourceRecord(path, root, layerForPath(path)));

  if (options.includeAncestors)
    for (const directory of ancestorDirs(root, home))
      for (const name of DOCUMENT_NAMES) {
        const path = join(directory, name);
        const placed = location(path);
        if (isFile(path) && !records.has(placed))
          records.set(placed, sourceRecord(path, root, "project"));
      }

  if (options.includeUserRules) {
    for (const path of walkUserInstructionFiles(home)) {
      const placed = location(path);
      if (records.has(placed) || skipped(path)) continue;
      const record = sourceRecord(path, root, "user");
      if (path.includes(`${sep}.cursor${sep}rules${sep}`) || path.endsWith(`${sep}.cursor${sep}rules`))
        records.set(placed, { ...record, kind: "user-rule", layer: "user", ecosystems: ["cursor"] });
      else records.set(placed, record);
    }
  }

  for (const [index, extra] of options.extraRules.entries()) {
    const path = extra.layer === "team" ? `cursor://team/${index + 1}` : `cursor://user/${index + 1}`;
    const kind = extra.layer === "team" ? "team-rule" : "user-rule";
    records.set(path, {
      path: extra.title,
      kind,
      layer: extra.layer,
      ecosystems: ["cursor"],
      activation: "always",
      specificity: 0,
      appliesUnder: null,
      description: extra.title,
      globs: [],
      body: redact(extra.text),
    });
  }

  return {
    root,
    sources: [...records.values()].sort(sortSources),
    missingFromDisk: [...MISSING_FROM_DISK],
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
    const dirName = basename(dir);
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }
      if (DOCUMENT_NAMES.has(entry.name)) found.push(abs);
      if (entry.name === "copilot-instructions.md" && dirName === ".github") found.push(abs);
      if (entry.name.endsWith(".instructions.md") && isUnderDir(dir, ".github", "instructions")) found.push(abs);
      if (entry.name.endsWith(".mdc") && isUnderDir(dir, ".cursor", "rules")) found.push(abs);
      if (entry.name.endsWith(".md") && isUnderDir(dir, ".claude", "rules")) found.push(abs);
      if (isRuleFileName(entry.name) && basename(dir) === "rules" && isPluginRulesDir(dir)) found.push(abs);
      if (entry.name === "SKILL.md" && parentNamed(dir, "skills")) found.push(abs);
      if (entry.name.endsWith(".md") && isUnderDir(dir, ".claude", "commands")) found.push(abs);
    }
  }
  return found;
}

function walkUserInstructionFiles(home: string): string[] {
  const found: string[] = [];
  const cursorRules = join(home, ".cursor", "rules");
  if (isDir(cursorRules)) found.push(...walkByExt(cursorRules, ".mdc"));
  const claudeMd = join(home, ".claude", "CLAUDE.md");
  if (isFile(claudeMd)) found.push(claudeMd);
  const claudeRules = join(home, ".claude", "rules");
  if (isDir(claudeRules)) found.push(...walkByExt(claudeRules, ".md"));
  for (const name of ["AGENTS.md", "AGENTS.override.md"]) {
    const path = join(home, ".codex", name);
    if (isFile(path)) found.push(path);
  }
  const copilot = join(home, ".copilot", "copilot-instructions.md");
  if (isFile(copilot)) found.push(copilot);
  const copilotInstructions = join(home, ".copilot", "instructions");
  if (isDir(copilotInstructions)) found.push(...walkBySuffix(copilotInstructions, ".instructions.md"));
  for (const rel of [
    join(".cursor", "skills"),
    join(".claude", "skills"),
    join(".agents", "skills"),
    join(".copilot", "skills"),
    join(".gemini", "skills"),
  ])
    found.push(...walkSkillFiles(join(home, rel)));
  found.push(...walkLocalPluginFiles(join(home, ".cursor", "plugins", "local")));
  return found;
}

function walkSkillFiles(dir: string): string[] {
  if (!isDir(dir)) return [];
  return walkFiles(dir).filter((path) => basename(path) === "SKILL.md" && !skipped(path) && !pathIncludes(path, "skills-cursor"));
}

function walkLocalPluginFiles(dir: string): string[] {
  if (!isDir(dir)) return [];
  return walkFiles(dir).filter((path) => {
    if (skipped(path)) return false;
    if (basename(path) === "SKILL.md") return true;
    return isCursorPluginRulePath(path);
  });
}

function pathIncludes(path: string, part: string): boolean {
  return path.split(sep).includes(part);
}

function isPluginRulesDir(dir: string): boolean {
  if (isUnderDir(dir, ".cursor", "plugins")) return true;
  return isDir(join(dirname(dir), ".cursor-plugin"));
}

function walkByExt(dir: string, ext: string): string[] {
  return walkFiles(dir).filter((path) => path.endsWith(ext) && !skipped(path));
}

function walkBySuffix(dir: string, suffix: string): string[] {
  return walkFiles(dir).filter((path) => path.endsWith(suffix) && !skipped(path));
}

function walkFiles(dir: string): string[] {
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
      found.push(abs);
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

function layerForPath(path: string): Source["layer"] {
  return basename(path) === "CLAUDE.local.md" ? "user" : "project";
}

function sourceRecord(path: string, root: string, layer: Source["layer"]): Source {
  const kind = kindFromPath(path);
  const text = readText(path);
  const { meta, body } = text === null ? { meta: {} as Frontmatter, body: "" } : splitFrontmatter(text);
  const { activation, globs } = classify(meta, kind);
  const description = typeof meta.description === "string" && meta.description ? meta.description : null;
  const record: Source = {
    path: displayPath(path, root),
    kind,
    layer,
    ecosystems: ecosystemsFor(kind, path),
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
  if (kind === "skill") {
    if (meta["disable-model-invocation"] === true) return { activation: "manual", globs: [] };
    if (typeof meta.description === "string" && meta.description.trim())
      return { activation: "intelligent", globs: [] };
    return { activation: "manual", globs: [] };
  }
  if (kind === "copilot-path-instructions") {
    const globs = normalizeGlobs(meta.applyTo ?? meta.globs);
    return { activation: "glob", globs };
  }
  if (kind === "claude-rule") {
    const globs = normalizeGlobs(meta.paths ?? meta.globs);
    if (globs.length > 0) return { activation: "glob", globs };
    return { activation: "always", globs: [] };
  }
  if (kind === "agents-md" || kind === "claude-md" || kind === "gemini-md" || kind === "copilot-instructions")
    return { activation: "always", globs: [] };
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
  if (!isScopedDocument(kind)) return 0;
  const scope = scopeParent(path);
  const rel = relative(root, scope);
  if (rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep)))
    return rel === "" ? 0 : rel.split(sep).filter(Boolean).length;
  return -relative(scope, root).split(sep).filter(Boolean).length;
}

function appliesUnder(path: string, root: string, kind: Kind): string | null {
  if (!isScopedDocument(kind)) return null;
  const scope = scopeParent(path);
  const rel = relative(root, scope);
  if (rel.startsWith("..") || rel.startsWith(sep)) return null;
  return rel === "" ? null : rel.split(sep).join("/");
}

function isScopedDocument(kind: Kind): boolean {
  return kind === "agents-md" || kind === "claude-md" || kind === "gemini-md" || kind === "copilot-instructions";
}

function scopeParent(path: string): string {
  const parent = dirname(location(path));
  if (CONFIG_DIR_NAMES.has(basename(parent))) return dirname(parent);
  return parent;
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

function isUnderDir(dir: string, ...parts: string[]): boolean {
  const segments = dir.split(sep);
  for (let index = 0; index <= segments.length - parts.length; index += 1) {
    if (parts.every((part, offset) => segments[index + offset] === part)) return true;
  }
  return false;
}

function parentNamed(dir: string, name: string): boolean {
  return basename(dirname(dir)) === name || basename(dir) === name;
}

export function defaultHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}
