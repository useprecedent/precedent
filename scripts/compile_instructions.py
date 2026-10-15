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


def main() -> int:
    parser = argparse.ArgumentParser(description="Inventory Cursor instruction files.")
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
            "missingFromDisk": [
                "team rules",
                "user rules stored in Cursor settings",
            ],
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def collect(root: Path, home: Path) -> list[dict[str, object]]:
    records: dict[Path, dict[str, object]] = {}
    for path in walk_instruction_files(root):
        records[location(path)] = source_record(path, root, "project")
    for directory in ancestor_dirs(root, home):
        for name in ("AGENTS.md", "CLAUDE.md"):
            path = directory / name
            placed = location(path)
            if path.is_file() and placed not in records:
                records[placed] = source_record(path, root, "project")
    user_rules = home / ".cursor" / "rules"
    if user_rules.is_dir():
        for path in sorted(user_rules.rglob("*.mdc")):
            placed = location(path)
            if placed in records or skipped(path):
                continue
            record = source_record(path, root, "user")
            record["kind"] = "user-rule"
            record["layer"] = "user"
            records[placed] = record
    return sorted(records.values(), key=sort_key)


def walk_instruction_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
        for name in filenames:
            if name in {"AGENTS.md", "CLAUDE.md"}:
                found.append(Path(dirpath) / name)
    rules = root / ".cursor" / "rules"
    if rules.is_dir():
        found.extend(path for path in rules.rglob("*.mdc") if not skipped(path))
    return found


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
    if path.name == "AGENTS.md":
        return "agents-md"
    if path.name == "CLAUDE.md":
        return "claude-md"
    return "project-rule"


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
    if kind in {"agents-md", "claude-md"}:
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


def specificity(path: Path, root: Path, kind: str) -> int:
    if kind not in {"agents-md", "claude-md"}:
        return 0
    parent = location(path).parent
    if parent == root or parent.is_relative_to(root):
        relative = parent.relative_to(root)
        return 0 if relative == Path(".") else len(relative.parts)
    return -len(root.relative_to(parent).parts)


def applies_under(path: Path, root: Path, kind: str) -> str | None:
    if kind not in {"agents-md", "claude-md"}:
        return None
    parent = location(path).parent
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
