# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [SemVer](https://semver.org/). A break in the Markdown report schema is a major version.

## Unreleased

## 1.1.0 - 2026-10-15

npm `@useprecedent/precedent` is `1.1.0`. The GitHub Action moving tag remains `v1.4` until the follow-up release tag.

### Added

- Skills and plugins as a fourth instruction source: always-on Cursor plugin rules join the merge; requestable skills and plugin rules are inventoried and left out until the task matches them.
- Inventory for `.cursor/plugins/**/rules`, `.cursor-plugin` packs, `~/.cursor/plugins/local`, and user-home `SKILL.md` files (`~/.cursor/skills`, `~/.claude/skills`, `~/.agents/skills`, `~/.copilot/skills`, `~/.gemini/skills`). `~/.cursor/skills-cursor` and marketplace plugin cache are not inventoried.

### Changed

- README opens with a plain-English “What it does” section.
- README and org profile use `brand/mark.png` instead of `brand/mark.svg`. Square mark is `brand/mark.png`; wordmark lockup is `brand/precedent.png`.
- README Action example pins `v1.4` (`41b4416`).
- README and skill document skill activation: `description` is description-gated; `disable-model-invocation: true` stays named-only.
- Action path filters watch pack rule files as `**/*.mdc`, `**/rules/*.md`, and `**/rules/*.markdown`; `**/.cursor-plugin/**` only matches pack metadata.

### Removed

- `brand/mark.svg` (incorrect mark).
- Duplicate rasters `brand/p-precedent.png` (same as `brand/mark.png`) and `brand/logo.png` (same as `brand/precedent.png`).

## 1.0.0 - 2026-10-15

This cut freezes the Markdown report contract. A break in that schema after this version is a major. npm `@useprecedent/precedent` is `1.0.0`. The GitHub Action moving tag for this cut is `v1.4`.

### Added

- Gold Action comment: live finding (who runs terminal commands) at `docs/gold-action-comment.md` and `docs/gold-action-comment.png`. Subject in the sample is `demonslayer/hashira`.
- Canonical rasters in `brand/`: `p-precedent.png` (org avatar / npm) and `precedent.png` (wordmark lockup).

### Changed

- README Action example pins `v1.3` (`3972603`).
- README documents skill install and `--ecosystem` for Cursor, Claude Code, Codex, Copilot, and Gemini CLI.
- Codex global skill path is `~/.agents/skills/precedent/` (`npx skills add -a codex -g`), not `~/.codex/skills`.
- Brand mark matches the stacked-P identity: `brand/mark.svg` and `brand/favicon.svg` on white, ink `#1E3A8A`. Product Hub rasters are the source: square mark for org/npm, wide lockup for the org profile header.

## 0.1.5 - 2026-10-15

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
