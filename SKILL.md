---
name: precedent
description: Compile the effective Cursor instruction set for this workspace and report always-on conflicts. Use when the user mentions Precedent, instruction compiler, effective policy, conflicting Cursor rules, AGENTS.md merge, or who wins between team/project/user rules.
---

# Precedent

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

Leave a glob, intelligent, or manual rule out of the merge unless this task matches its globs, its description, or the user named it.

A conflict is two statements that require different actions in the same situation. Paraphrases of the same action are not a conflict. A source with `aliasOf` is a symlink; it is the same text as its target, so it is not a second authority.

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

Omit an empty section. When Conflicts is empty, say "No conflicts in the always-on instructions."

Labels stay honest: **measured** is file inventory and documented precedence. **inferred** is semantic contradiction.

Follow each effective statement for the rest of the chat. When a conflict is unresolved, ask which statement to follow before doing the thing those statements disagree about.
