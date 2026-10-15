<p align="center">
  <img src="brand/logo.png" alt="Precedent" width="360" />
</p>

# Precedent

Compile Cursor instruction files for a repository path, apply documented precedence, and report always-on semantic conflicts. Output is Markdown (human/PR) or JSON (automation).

The compiler does not guarantee model compliance. It records which statements should win and surfaces unresolved cases when Cursor’s docs do not define an order.

## Components

| Interface | Role |
| --- | --- |
| CLI | `npx @useprecedent/precedent` — report or JSON |
| GitHub Action | PR comment on policy file changes; optional `fail-on-unresolved` |
| Skill | Same compile flow inside a Cursor session ([SKILL.md](SKILL.md)) |

**Measured:** file inventory, activation mode, symlinks, documented layer/specificity.

**Inferred:** semantic contradiction between always-on statements (paraphrases of the same action are not conflicts).

## Install

```bash
npx @useprecedent/precedent
```

```bash
npx @useprecedent/precedent --root . --json
npx @useprecedent/precedent --root . --inventory
```

Node 22+. Inventory JSON is also available from Python (same shape as the skill script):

```bash
python3 scripts/compile_instructions.py --root .
```

## Inputs

**On disk (default compile):**

- `AGENTS.md` / `CLAUDE.md` (repo root, nested paths, optional ancestors with `--no-ancestors` off)
- `.cursor/rules/*.mdc` — classified as always / glob / intelligent / manual
- `~/.cursor/rules` when `--user-rules` is enabled (default for local CLI; off in the Action)

Symlinks are recorded with `aliasOf` so duplicate paths are not separate authorities.

**Not on disk:**

- Cursor team rules
- User rules stored only in Cursor settings

Pass chat-only rules without faking paths:

```bash
npx @useprecedent/precedent --root . --extra-rules extra-rules.json
```

`extra-rules.json` is a JSON array of `{ "layer": "team" | "user", "title": string, "text": string }`.

## Precedence (v1, always-on)

1. Team over project over user
2. Among `AGENTS.md` / `CLAUDE.md`, higher specificity wins in the same chain; nested files apply only under `appliesUnder`
3. Always-on `.mdc` rules and covering `AGENTS.md` / `CLAUDE.md` in the same directory are one layer — conflicts there are **unresolved**
4. Glob, intelligent, and manual rules are excluded from the merge in v1

## CLI flags

| Flag | Effect |
| --- | --- |
| `--root` | Repository root (default: cwd) |
| `--path` | Path inside the repo to compile for (default: `.`) |
| `--compare <dir>` | Report only findings new vs another checkout |
| `--inventory` | Emit inventory JSON only |
| `--json` | Full report JSON |
| `--extra-rules <file>` | Team/user rules from session |
| `--no-user-rules` | Skip `~/.cursor/rules` |
| `--no-ancestors` | Skip ancestor `AGENTS.md` / `CLAUDE.md` |
| `--fail-on-unresolved` | Exit 1 if unresolved always-on conflicts exist |

## Report format

CLI and Action share one Markdown schema. Empty PR deltas use a short note; PRs with new conflicts include full scope sections and numbered findings.

Empty delta (typical Action comment):

```
# Precedent

practicelink/pl-cmp

Base a1b2c3d (main) · head e4f5g6h · https://github.com/practicelink/pl-cmp/compare/a1b2c3d...e4f5g6h

Scope: always-on · 8 git sources, 4 in force · team rules and Cursor settings user rules are not in this report.

No new always-on instruction conflicts relative to main.

<details>
<summary>Methodology</summary>
...
</details>
```

New conflict on a PR (abbreviated):

```
## Findings

1. **who runs terminal commands** (`unresolved`, inferred)
   - statement: The agent runs terminal commands. (`AGENTS.md:3`)
   - statement: I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT. (`.cursor/rules/user-commands.mdc:4`)
```

## GitHub Action

Comment-only by default. Pin a release tag (see [releases](https://github.com/useprecedent/precedent/releases)).

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
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: useprecedent/precedent@v1.2
        with:
          fail-on-unresolved: false
```

The Action compiles from git only. Team rules and Cursor settings user rules are out of scope unless committed or passed via a custom workflow that supplies `--extra-rules`.

## Limits

- No proof that the model followed the effective policy
- Glob / intelligent / manual activation and plugin skills are not merged in v1
- Semantic v1 is a local heuristic (no API calls in the default compile path)

## Runtime

Compile and inventory run on the host running the CLI or Action. The default Action does not send repository content to a third-party Precedent service.

## License

Apache-2.0. See [LICENSE](LICENSE).
