# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [SemVer](https://semver.org/). A break in the Markdown report schema is a major version.

## Unreleased

### Added

- `SECURITY.md` and this changelog.
- Vector mark and 16px favicon under `brand/`.
- Frozen report-contract document for CLI and Action Markdown.
- Inventory for Copilot, Claude Code, Codex, and Gemini instruction files, plus `--ecosystem`.
- Living precedence spec at `docs/precedence.md`.
- Semantic topics for git hooks and force-push.
- Multi-agent eval fixture under `test/fixtures/multi-agent`.

### Changed

- README Action example pins a release SHA in addition to the `v1.2` tag.
- Action branding uses the `shield` icon.

## 0.1.4 - 2026-10-15

Git only; not published to npm at the time of this entry.

### Added

- Packaged CLI smoke test and Node 22/26 CI matrix.
- Cursor skill install path and project-scoped skill symlink.
- Session report example under `docs/session-report.md`.
- Branch-protection gate job named `test`.

## 0.1.3 - 2026-10-15

### Changed

- README rewritten as an engineering manual.
- npm package description synced to the same voice.

## 0.1.2 - 2026-10-15

### Changed

- Compact empty PR comments: repository subject, short SHAs, git-only empty state.
- Canonical Action pin `useprecedent/precedent@v1.2`.

## 0.1.1 - 2026-10-15

### Added

- Unified CLI and Action Markdown renderer.
- Provenance (event, base, head, compare URL) on PR comments.

### Changed

- Subject is `owner/repo` in GitHub Actions, directory basename locally. Runner checkout paths are not printed.

## 0.1.0 - 2026-10-15

### Added

- File inventory for `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules`.
- Layer and specificity precedence with unresolved same-layer clashes.
- Semantic v1 on always-on statements (local heuristic).
- `npx @useprecedent/precedent` CLI, GitHub Action, and Cursor skill.
