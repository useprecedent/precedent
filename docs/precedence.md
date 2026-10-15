# Precedence spec

Living document. Precedent applies **documented** order when a vendor has published one. When two always-on sources sit in the same layer and the vendor has not ordered them, the finding is **unresolved**.

Dates are when this file was last checked against public docs, not when the vendor shipped the behavior.

## Cursor (checked 2026-10-15)

Layer order: team over project over user.

Among `AGENTS.md` / `CLAUDE.md`, higher specificity wins in the same chain. Nested files apply only under `appliesUnder`.

Always-on `.cursor/rules/*.mdc` and covering `AGENTS.md` / `CLAUDE.md` in the same directory are one layer. Cursor has not documented an order between them.

Glob, intelligent, and manual `.mdc` files stay out of the v1 merge unless the task matches them.

Always-on Cursor plugin rules (`alwaysApply: true` under `.cursor/plugins/**/rules`, a `.cursor-plugin` pack, or `~/.cursor/plugins/local`) join the always-on merge. They sit in the project layer when the pack is in the repo, and the user layer when it is under home. Cursor has not documented an order between always-on plugin rules and covering `AGENTS.md` / `CLAUDE.md` in the same layer.

Requestable plugin rules and skills stay out of the merge unless this task matches their description or the user named them. Marketplace plugin cache (`~/.cursor/plugins/cache`) is not inventoried: the enabled-plugin set is not a stable file API.

## Claude Code (checked 2026-10-15)

Project instructions: `./CLAUDE.md` or `./.claude/CLAUDE.md`. User: `~/.claude/CLAUDE.md`. `CLAUDE.local.md` is personal for the project (user layer here).

`.claude/rules/*.md` is always-on unless `paths` frontmatter scopes it (treated as glob, left out of v1).

Claude Code can read `AGENTS.md` when no `CLAUDE.md` / `CLAUDE.local.md` is present (`claude-md-or-agents-md`, default). Both together is a setting (`claude-md-and-agents-md`). Precedent inventories both files when they exist. Disagreement at the same layer is unresolved.

## OpenAI Codex (checked 2026-10-15)

Discovery, nearest directory later in the concatenated prompt:

1. `~/.codex/AGENTS.override.md` or else `~/.codex/AGENTS.md`
2. From project root down to the working directory: `AGENTS.override.md`, then `AGENTS.md`, then configured fallbacks; at most one file per directory

Precedent records nested `AGENTS.md` / `AGENTS.override.md` with `appliesUnder` and specificity. It does not emulate Codex concatenation or the 32 KiB cap.

## GitHub Copilot (checked 2026-10-15)

Published priority, highest first:

1. Personal instructions (GitHub UI; not on disk)
2. Path-specific `.github/instructions/**/*.instructions.md` (`applyTo`)
3. `.github/copilot-instructions.md`
4. Agent instructions (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)
5. Organization instructions (GitHub UI; not on disk)

User-home files: `~/.copilot/copilot-instructions.md` and `~/.copilot/instructions/**/*.instructions.md`.

Path-specific Copilot files are glob activation and stay out of semantic v1. Repo-wide Copilot instructions are always-on. Clash with `AGENTS.md` at the project layer is unresolved: Copilot's list is Copilot-only, not a Cursor merge order.

## Gemini CLI (checked 2026-10-15)

`GEMINI.md` is inventoried as always-on document files, including nested copies with `appliesUnder`. Copilot CLI also reads `GEMINI.md`.

## Cross-ecosystem compiles

Default CLI/Action compile is `all`: every inventoried always-on file participates. `--ecosystem cursor|claude-code|codex|copilot|gemini` leaves other ecosystems out of the merge (they appear under **Left out**).

A symlink is never a second authority (`aliasOf`).

## Out of v1

- Glob / intelligent / manual activation, including Copilot `applyTo` and Claude `paths`
- Requestable skills and requestable plugin rules (description-gated or named-only)
- Cursor marketplace plugin cache and the enabled-plugin set
- GitHub organization Copilot instructions and Cursor team rules, unless passed as `--extra-rules`
- Proof that a model complied
