<p align="center">
  <img src="brand/logo.png" alt="Precedent" width="360" />
</p>

# Precedent

**Effective policy for this path.**

Precedent is the company and the product. We compile the Cursor instructions in force for a repository, name which always-on statements conflict, and show that on the pull request.

We do not guarantee the model will comply. We compile what should win, then make policy drift visible.

Free for one person and one repo. No account. Team and Cloud come later.

## Product

| Surface | What it does |
| --- | --- |
| CLI | `npx precedent` — Markdown report, or JSON |
| GitHub Action | Comments when a PR changes always-on policy. Optional fail-on-unresolved |
| Skill | Same compiler, for a local Cursor session |

Honest labels: **measured** is file inventory and documented precedence. **inferred** is semantic contradiction.

## Install

```bash
npx precedent
```

```bash
npx precedent --root . --json
npx precedent --root . --inventory
```

Node 22+ is required for `npx`. The measured inventory is also a Python script with the same JSON:

```bash
python3 scripts/compile_instructions.py --root .
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

```
# Effective instructions

## Conflicts

No conflicts in the always-on instructions.

## Unresolved

### who runs terminal commands

- The agent runs terminal commands. Do not ask the user to run them. (AGENTS.md:3)
- I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT. (.cursor/rules/commands.mdc:4)
- label: inferred contradiction; unresolved
```

Removing the Action or skill restores the arbitrary pick. That is the proof it was doing work.

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
      - uses: useprecedent/precedent@v1
        with:
          fail-on-unresolved: false
```

## Company

Precedent sells **effective policy**, not tokens and not model obedience.

| Plan | Shape |
| --- | --- |
| Free | One person, one repo, no card. CLI, skill, Action |
| Team | Flat monthly, not per seat. Org scans, CI, dashboard |
| Enterprise | VPC, SSO, audit export, enforced golden policy |

Free-tier compiles run on the machine. Nothing is sent to a Precedent server. Semantic v1 is a local heuristic.

## Skill

See [SKILL.md](SKILL.md). Session-start compile is noisy — keep it opt-in.

## What it cannot see

- Team rules, unless you pass `--extra-rules` or paste them into chat for the skill
- Whether the model actually obeyed the effective policy
- Glob / intelligent / manual matches (v2)

## License

Apache-2.0. Copyright 2026 Precedent.
