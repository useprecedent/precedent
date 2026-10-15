#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


SKIP_DIRS = {
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
}
BODY_LIMIT = 30_000
FILE_LIMIT = 200_000
DOCUMENT_NAMES = {
    "AGENTS.md",
    "AGENTS.override.md",
    "CLAUDE.md",
    "CLAUDE.local.md",
    "GEMINI.md",
}
CONFIG_DIR_NAMES = {".claude", ".github", ".codex", ".copilot"}
MISSING_FROM_DISK = [
    "team rules",
    "user rules stored in Cursor settings",
    "Copilot personal and organization instructions (GitHub UI)",
    "Claude Code managed settings",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Inventory instruction files for Cursor, Claude Code, Codex, Copilot, and Gemini.")
    parser.add_argument("--root", default=".", help="Workspace root to compile")
    parser.add_argument("--home", default=str(Path.home()), help="Home directory for user rules and ancestor stop")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    home = Path(args.home).expanduser().resolve()
    if not root.is_dir():
        print(f"root is not a directory: {root}", file=sys.stderr)
        return 2
    sources = collect(root, home)
    json.dump(
        {
            "root": str(root),
            "sources": sources,
            "missingFromDisk": MISSING_FROM_DISK,
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def collect(root: Path, home: Path) -> list[dict[str, object]]:
    records: dict[Path, dict[str, object]] = {}
    for path in walk_instruction_files(root):
        records[location(path)] = source_record(path, root, layer_for_path(path))
    for directory in ancestor_dirs(root, home):
        for name in DOCUMENT_NAMES:
            path = directory / name
            placed = location(path)
            if path.is_file() and placed not in records:
                records[placed] = source_record(path, root, "project")
    for path in walk_user_instruction_files(home):
        placed = location(path)
        if placed in records or skipped(path):
            continue
        record = source_record(path, root, "user")
        if ".cursor" in path.parts and "rules" in path.parts:
            record["kind"] = "user-rule"
            record["layer"] = "user"
            record["ecosystems"] = ["cursor"]
        records[placed] = record
    return sorted(records.values(), key=sort_key)


def walk_instruction_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
        directory = Path(dirpath)
        parts = directory.parts
        for name in filenames:
            path = directory / name
            if name in DOCUMENT_NAMES:
                found.append(path)
            elif name == "copilot-instructions.md" and directory.name == ".github":
                found.append(path)
            elif name.endswith(".instructions.md") and under_dir(parts, (".github", "instructions")):
                found.append(path)
            elif name.endswith(".mdc") and under_dir(parts, (".cursor", "rules")):
                found.append(path)
            elif name.endswith(".md") and under_dir(parts, (".claude", "rules")):
                found.append(path)
            elif name == "SKILL.md" and "skills" in parts:
                found.append(path)
            elif name.endswith(".md") and under_dir(parts, (".claude", "commands")):
                found.append(path)
    return found


def walk_user_instruction_files(home: Path) -> list[Path]:
    found: list[Path] = []
    cursor_rules = home / ".cursor" / "rules"
    if cursor_rules.is_dir():
        found.extend(path for path in sorted(cursor_rules.rglob("*.mdc")) if not skipped(path))
    claude_md = home / ".claude" / "CLAUDE.md"
    if claude_md.is_file():
        found.append(claude_md)
    claude_rules = home / ".claude" / "rules"
    if claude_rules.is_dir():
        found.extend(path for path in sorted(claude_rules.rglob("*.md")) if not skipped(path))
    for name in ("AGENTS.md", "AGENTS.override.md"):
        path = home / ".codex" / name
        if path.is_file():
            found.append(path)
    copilot = home / ".copilot" / "copilot-instructions.md"
    if copilot.is_file():
        found.append(copilot)
    copilot_instructions = home / ".copilot" / "instructions"
    if copilot_instructions.is_dir():
        found.extend(
            path
            for path in sorted(copilot_instructions.rglob("*.instructions.md"))
            if not skipped(path)
        )
    return found


def under_dir(parts: tuple[str, ...], needle: tuple[str, ...]) -> bool:
    size = len(needle)
    return any(parts[index : index + size] == needle for index in range(len(parts) - size + 1))


def layer_for_path(path: Path) -> str:
    return "user" if path.name == "CLAUDE.local.md" else "project"


def ancestor_dirs(root: Path, home: Path) -> list[Path]:
    dirs: list[Path] = []
    current = root.parent
    while current != current.parent and len(dirs) < 8:
        dirs.append(current)
        if current == home:
            break
        current = current.parent
    return dirs


def skipped(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def source_record(path: Path, root: Path, layer: str) -> dict[str, object]:
    kind = kind_for(path)
    text = read_text(path)
    meta, body = split_frontmatter(text) if text is not None else ({}, "")
    activation, globs = classify(meta, kind)
    description = meta.get("description")
    record: dict[str, object] = {
        "path": display_path(path, root),
        "kind": kind,
        "layer": layer,
        "ecosystems": ecosystems_for(kind, path),
        "activation": activation,
        "specificity": specificity(path, root, kind),
        "appliesUnder": applies_under(path, root, kind),
        "description": description if isinstance(description, str) and description else None,
        "globs": globs,
    }
    if path.is_symlink():
        record["aliasOf"] = os.readlink(path)
    if text is None:
        record["bodyOmittedReason"] = "unreadable"
        return record
    if activation != "always":
        return record
    if len(body) > BODY_LIMIT:
        record["body"] = body[:BODY_LIMIT]
        record["bodyTruncated"] = True
        return record
    record["body"] = body
    return record


def kind_for(path: Path) -> str:
    name = path.name
    parent = path.parent.name
    grand = path.parent.parent.name
    if name in {"AGENTS.md", "AGENTS.override.md"}:
        return "agents-md"
    if name in {"CLAUDE.md", "CLAUDE.local.md"}:
        return "claude-md"
    if name == "GEMINI.md":
        return "gemini-md"
    if name == "copilot-instructions.md":
        return "copilot-instructions"
    if name.endswith(".instructions.md"):
        return "copilot-path-instructions"
    if name == "SKILL.md" or parent == "commands":
        return "skill"
    if parent == "rules" and grand == ".claude" and name.endswith(".md"):
        return "claude-rule"
    if name.endswith(".mdc"):
        return "project-rule"
    return "project-rule"


def ecosystems_for(kind: str, path: Path | None = None) -> list[str]:
    parts = path.parts if path is not None else ()
    name = path.name if path is not None else ""
    if ".codex" in parts or name == "AGENTS.override.md":
        return ["codex"]
    if kind == "user-rule":
        if ".claude" in parts:
            return ["claude-code"]
        if ".copilot" in parts:
            return ["copilot"]
        return ["cursor"]
    if kind == "agents-md":
        return ["cursor", "codex", "copilot", "claude-code"]
    if kind == "claude-md":
        return ["cursor", "claude-code", "copilot"]
    if kind == "claude-rule":
        return ["claude-code", "copilot"]
    if kind == "gemini-md":
        return ["gemini", "copilot"]
    if kind in {"copilot-instructions", "copilot-path-instructions"}:
        return ["copilot"]
    if kind == "skill":
        if ".claude" in parts:
            return ["claude-code"]
        return ["cursor"]
    return ["cursor"]


def read_text(path: Path) -> str | None:
    try:
        if path.stat().st_size > FILE_LIMIT:
            return None
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def split_frontmatter(text: str) -> tuple[dict[str, object], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    for index in range(1, len(lines)):
        if lines[index].strip() != "---":
            continue
        meta = parse_frontmatter("\n".join(lines[1:index]))
        body = "\n".join(lines[index + 1 :]).lstrip("\n")
        return meta, body
    return {}, text


def parse_frontmatter(block: str) -> dict[str, object]:
    parsed: dict[str, object] = {}
    lines = block.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            index += 1
            continue
        key, _, raw = line.partition(":")
        key = key.strip()
        raw = raw.strip()
        if raw in {">", ">-", "|", "|-"}:
            index += 1
            folded: list[str] = []
            while index < len(lines) and (lines[index].startswith((" ", "\t")) or lines[index].strip() == ""):
                if lines[index].strip() == "":
                    break
                folded.append(lines[index].strip())
                index += 1
            parsed[key] = " ".join(folded)
            continue
        if raw == "":
            index += 1
            items: list[str] = []
            while index < len(lines) and lines[index].lstrip().startswith("- "):
                items.append(unquote(lines[index].lstrip()[2:].strip()))
                index += 1
            if items:
                parsed[key] = items
            continue
        parsed[key] = coerce(raw)
        index += 1
    return parsed


def classify(meta: dict[str, object], kind: str) -> tuple[str, list[str]]:
    if kind == "skill":
        return "manual", []
    if kind == "copilot-path-instructions":
        globs = normalize_globs(meta.get("applyTo", meta.get("globs")))
        if globs:
            return "glob", globs
        return "always", []
    if kind == "claude-rule":
        globs = normalize_globs(meta.get("paths", meta.get("globs")))
        if globs:
            return "glob", globs
        return "always", []
    if kind in {"agents-md", "claude-md", "gemini-md", "copilot-instructions"}:
        return "always", []
    globs = normalize_globs(meta.get("globs"))
    if meta.get("alwaysApply") is True:
        return "always", globs
    if globs:
        return "glob", globs
    description = meta.get("description")
    if isinstance(description, str) and description.strip():
        return "intelligent", []
    return "manual", []


def normalize_globs(value: object) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str) and item]
    if isinstance(value, str) and value.strip():
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if not inner:
                return []
            return [unquote(part.strip()) for part in inner.split(",") if part.strip()]
        return [unquote(part.strip()) for part in value.split(",") if part.strip()]
    return []


def coerce(raw: str) -> object:
    if raw.startswith("[") and raw.endswith("]"):
        return normalize_globs(raw)
    lowered = raw.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    return unquote(raw)


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def location(path: Path) -> Path:
    return path.parent.resolve() / path.name


def is_scoped_document(kind: str) -> bool:
    return kind in {"agents-md", "claude-md", "gemini-md", "copilot-instructions"}


def scope_parent(path: Path) -> Path:
    parent = location(path).parent
    if parent.name in CONFIG_DIR_NAMES:
        return parent.parent
    return parent


def specificity(path: Path, root: Path, kind: str) -> int:
    if not is_scoped_document(kind):
        return 0
    parent = scope_parent(path)
    if parent == root or parent.is_relative_to(root):
        relative = parent.relative_to(root)
        return 0 if relative == Path(".") else len(relative.parts)
    return -len(root.relative_to(parent).parts)


def applies_under(path: Path, root: Path, kind: str) -> str | None:
    if not is_scoped_document(kind):
        return None
    parent = scope_parent(path)
    if not parent.is_relative_to(root):
        return None
    relative = parent.relative_to(root)
    if relative == Path("."):
        return None
    return relative.as_posix()


def display_path(path: Path, root: Path) -> str:
    placed = location(path)
    if placed.is_relative_to(root):
        return placed.relative_to(root).as_posix()
    return str(placed)


def sort_key(record: dict[str, object]) -> tuple[int, int, str]:
    layer = record["layer"]
    specificity_value = record["specificity"]
    path = record["path"]
    layer_rank = 0 if layer == "project" else 1
    depth = specificity_value if isinstance(specificity_value, int) else 0
    return (layer_rank, -depth, path if isinstance(path, str) else "")


if __name__ == "__main__":
    sys.exit(main())
