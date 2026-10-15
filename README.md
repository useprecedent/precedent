# Precedent

Compile the **effective Cursor instruction set** for a repo path. Report which always-on statements conflict, and cite the files.

Precedent does not guarantee the model will comply. It compiles what should win, then makes policy drift visible in PRs.

This repo is Apache-2.0 and is **not** part of Career Manager (`pl-cmp`).

## Install

```bash
npx @jakearmijo/precedent
```

```bash
npx @jakearmijo/precedent --root . --json
npx @jakearmijo/precedent --root . --inventory
```

Node 22+ is required for `npx`. The measured file inventory is the original Python script the skill already used — same JSON:

```bash
python3 scripts/compile_instructions.py --root .
python3 scripts/test_compile_instructions.py
```

## What it sees

**Measured** (files on disk, documented precedence):

- `AGENTS.md` / `CLAUDE.md` (repo, nested, optional ancestors)
- `.cursor/rules/*.mdc` classified as always / glob / intelligent / manual
- `~/.cursor/rules` when `--user-rules` is on
- Symlinks marked `aliasOf` so a copy is not a second authority

**Not on disk** (pass with `--extra-rules`):

- Cursor team rules
- User rules stored only in Cursor settings

**Out of v1:** glob, intelligent, and manual rules; plugin skills.

## Precedence

1. Team over project over user
2. Higher-specificity `AGENTS.md` / `CLAUDE.md` wins in the same chain; nested files apply under `appliesUnder`
3. Always-on project rules and covering `AGENTS.md` / `CLAUDE.md` are one layer — disagreement is **unresolved**
4. Glob / intelligent / manual stay out of the merge unless a later version matches this task

Contradiction detection is **inferred**. Paraphrases of the same action are not a conflict.

## Sample report

A PR that adds a contradicting always-on rule next to “the agent runs terminal commands”:

```
# Effective instructions

## Conflicts

No conflicts in the always-on instructions.

## Unresolved

### who runs terminal commands

- The agent runs terminal commands. Do not ask the user to run them. (AGENTS.md:3)
- I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT. (.cursor/rules/commands.mdc:4)
- label: inferred contradiction; unresolved

## Left out

- apps/meded/CLAUDE.md — document, symlink alias of AGENTS.md; not a second authority
```

Deleting the Action or skill restores the arbitrary pick. That is the proof it was doing work.

## GitHub Action

Comment-only by default. Optionally fail the check.

```yaml
name: Precedent
on:
  pull_request:
    paths:
      - "AGENTS.md"
      - "CLAUDE.md"
      - "**/AGENTS.md"
      - "**/CLAUDE.md"
      - ".cursor/rules/**"
jobs:
  compile:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: jakearmijo/precedent@v1
        with:
          fail-on-unresolved: false
```

## Skill

See [SKILL.md](SKILL.md). Session-start compile is noisy — keep it opt-in.

## What it cannot see

- Team rules, unless you pass `--extra-rules` or paste them into chat for the skill
- Whether the model actually obeyed the effective policy
- Glob / intelligent / manual matches (v2)

## License

Apache-2.0. No content is sent to a Precedent server. Semantic v1 is a local heuristic.
