---
name: precedent
description: Compile the effective Cursor instruction set for this workspace and report always-on conflicts. Use when the user mentions Precedent, instruction compiler, /instruction-compiler, effective policy, conflicting Cursor rules, AGENTS.md merge, or who wins between team/project/user rules.
---

# Precedent

Install for Cursor (once): `npx skills add useprecedent/precedent -a cursor -g --skill precedent -y` — see [README](https://github.com/useprecedent/precedent#install-the-cursor-skill).

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

`missingFromDisk` names those two groups. A file under `~/.cursor/rules` is already in sources as `user-rule`.

To feed chat-only rules without pretending they are on disk:

```
npx --yes @useprecedent/precedent --root . --extra-rules extra-rules.json
```

## Decide

Compare statements that are in force for the files this task touches.

A team rule wins over a project source. A project source wins over a user rule.

Among `AGENTS.md` and `CLAUDE.md`, the higher specificity wins, and only against a less specific file in that same chain. A nested file applies under `appliesUnder`. Outside that directory, ignore it.

Always-on project rules and the `AGENTS.md` / `CLAUDE.md` files that cover the same directory are one layer. When they disagree, the conflict is unresolved. Cursor has not documented an order between them.

Leave a glob, intelligent, manual, or requestable plugin rule out of the merge unless this task matches its globs, its description, or the user named it.

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
