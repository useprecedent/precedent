import { basename, dirname } from "node:path";
import type { Ecosystem, Kind, Source } from "./types.ts";

export const DOCUMENT_NAMES = new Set([
  "AGENTS.md",
  "AGENTS.override.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "GEMINI.md",
]);

export const CONFIG_DIR_NAMES = new Set([".claude", ".github", ".codex", ".copilot"]);

export const ECOSYSTEMS: Ecosystem[] = ["cursor", "claude-code", "codex", "copilot", "gemini"];

export function isEcosystem(value: string): value is Ecosystem {
  return (ECOSYSTEMS as string[]).includes(value);
}

export function kindFor(path: string): Kind {
  const name = basename(path);
  const parent = basename(dirname(path));
  const grand = basename(dirname(dirname(path)));
  if (name === "AGENTS.md" || name === "AGENTS.override.md") return "agents-md";
  if (name === "CLAUDE.md" || name === "CLAUDE.local.md") return "claude-md";
  if (name === "GEMINI.md") return "gemini-md";
  if (name === "copilot-instructions.md") return "copilot-instructions";
  if (name.endsWith(".instructions.md")) return "copilot-path-instructions";
  if (name === "SKILL.md" || parent === "commands") return "skill";
  if (parent === "rules" && grand === ".claude" && name.endsWith(".md")) return "claude-rule";
  if (name.endsWith(".mdc")) return "project-rule";
  return "project-rule";
}

export function ecosystemsFor(kind: Kind, path = ""): Ecosystem[] {
  const segments = path.split(/[/\\]/);
  if (segments.includes(".codex") || basename(path) === "AGENTS.override.md") return ["codex"];
  if (kind === "user-rule") {
    if (segments.includes(".claude")) return ["claude-code"];
    if (segments.includes(".copilot")) return ["copilot"];
    return ["cursor"];
  }
  if (kind === "agents-md") return ["cursor", "codex", "copilot", "claude-code"];
  if (kind === "claude-md") {
    if (segments.includes(".claude")) return ["claude-code", "copilot"];
    if (basename(path) === "CLAUDE.local.md") return ["claude-code"];
    return ["cursor", "claude-code", "copilot"];
  }
  if (kind === "claude-rule") return ["claude-code", "copilot"];
  if (kind === "gemini-md") return ["gemini", "copilot"];
  if (kind === "copilot-instructions" || kind === "copilot-path-instructions") return ["copilot"];
  if (kind === "skill") {
    if (segments.includes(".claude")) return ["claude-code"];
    return ["cursor"];
  }
  if (kind === "project-rule" || kind === "team-rule") return ["cursor"];
  return ["cursor"];
}

export function isDocumentKind(kind: Kind): boolean {
  return kind === "agents-md" || kind === "claude-md" || kind === "gemini-md" || kind === "copilot-instructions";
}

export function sourceMatchesEcosystem(source: Source, ecosystem: "all" | Ecosystem): boolean {
  if (ecosystem === "all") return true;
  return source.ecosystems.includes(ecosystem);
}
