---
name: precedent
description: Compile the effective instruction set for this workspace (Cursor, Claude Code, Codex, Copilot, Gemini) and report always-on conflicts. Use when the user mentions Precedent, instruction compiler, /instruction-compiler, effective policy, conflicting rules, AGENTS.md merge, or who wins between team/project/user rules.
---

# Precedent

Install once for your agent: see [README](https://github.com/useprecedent/precedent#use-with-your-coding-tool).

Compile the instructions for the workspace you have open. Do not edit instruction files unless the user asks.

## Collect

```
python3 scripts/compile_instructions.py --root .
```

Or the npm CLI (same inventory JSON, plus Markdown and semantic findings):

```
npx --yes @useprecedent/precedent --root . --inventory
npx --yes @useprecedent/precedent --root .
```

The CLI sees files only. After it runs, add every team rule and every user rule from this chat that is not already in sources. Give team rules layer `team` and specificity 0. Give settings user rules layer `user` and specificity 0.

`missingFromDisk` names groups the files cannot see (Cursor team/settings rules, Copilot GitHub UI instructions, Claude managed settings). A file under `~/.cursor/rules` is already in sources as `user-rule`. User-home Claude, Codex, and Copilot files are inventoried when the CLI is run with user rules enabled.

Default compile is every ecosystem. Pass `--ecosystem cursor` (or `claude-code`, `codex`, `copilot`, `gemini`) to leave other vendors out of the merge.

To feed chat-only rules without pretending they are on disk:

```
npx --yes @useprecedent/precedent --root . --extra-rules extra-rules.json
```

## Decide

Compare statements that are in force for the files this task touches.

A team rule wins over a project source. A project source wins over a user rule.

Among document files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, repo-wide Copilot instructions), the higher specificity wins, and only against a less specific file in that same chain. A nested file applies under `appliesUnder`. Outside that directory, ignore it.

Always-on project rules and the covering document files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, repo-wide Copilot instructions) in the same directory are one layer. When they disagree, the conflict is unresolved unless a vendor has documented an order for that pair. Cursor has not documented an order between always-on `.mdc` files and covering `AGENTS.md`. Copilot’s own priority list is Copilot-only.

Leave a glob, intelligent, manual, path-scoped Copilot/Claude rule, or requestable plugin/skill out of the merge unless this task matches its globs, its description, or the user named it.

See [docs/precedence.md](docs/precedence.md).

A conflict is two statements that require different actions in the same situation. Paraphrases of the same action are not a conflict. A source with `aliasOf` is a symlink; it is the same text as its target, so it is not a second authority.

Scope the compile to the paths this task touches. Nested `AGENTS.md` / `CLAUDE.md` outside `appliesUnder` belong in **Left out**, not in the merge. User rules that only apply to PRs, browser checks, or other contexts belong in **Left out** when this task is not that kind of work.

## Report

```
# Effective instructions

## Conflicts
### [behavior]
- effective: [statement] ([path], [why it wins])
- overridden: [statement] ([path])

## Unresolved
### [behavior]
- [statement] ([path])
- [statement] ([path])

## Left out
- [path] — [activation], [reason it is not in force]
```

Omit an empty section. When Conflicts is empty, say "No conflicts in the always-on instructions." An empty **Unresolved** section is normal when project `.mdc` and `AGENTS.md` agree at the same directory layer.

Labels stay honest: **measured** is file inventory and documented precedence. **inferred** is semantic contradiction.

For **Conflicts**, cite why the winner wins (for example project over user). For **Left out**, give a short reason (path scope, activation mode, or task type).

Follow each effective statement for the rest of the chat. When **Unresolved** is non-empty, ask which statement to follow before doing the thing those statements disagree about.

Example shape (monorepo): [docs/session-report.md](docs/session-report.md).
