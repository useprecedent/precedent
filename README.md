<p align="center">
  <img src="brand/mark.svg" alt="Precedent" width="64" height="64" />
</p>

# Precedent

Compile instruction files for a repository path (Cursor, Claude Code, Codex, Copilot, Gemini), apply documented precedence, and report always-on semantic conflicts. Output is Markdown (human/PR) or JSON (automation).

The compiler does not guarantee model compliance. It records which statements should win and surfaces unresolved cases when a vendor has not defined an order.

## Components

| Interface | Role |
| --- | --- |
| CLI | `npx @useprecedent/precedent` — report or JSON |
| GitHub Action | PR comment on policy file changes; optional `fail-on-unresolved` |
| Skill | Same compile flow inside a Cursor session ([SKILL.md](SKILL.md)) |

### Which interface?

| You want… | Use |
| --- | --- |
| Effective policy and conflicts while coding in Cursor (including team rules and settings-only user rules from chat) | [Cursor skill](#install-the-cursor-skill) |
| Scripts, local checks, or JSON for other tools | [CLI](#install-cli) |
| PR comments when instruction files change in git | [GitHub Action](#github-action) |

**Measured:** file inventory, activation mode, symlinks, documented layer/specificity.

**Inferred:** semantic contradiction between always-on statements (paraphrases of the same action are not conflicts).

## Install (CLI)

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

## Install the Cursor skill

Cursor loads skills from `~/.cursor/skills/<name>/SKILL.md` (global) or `.cursor/skills/<name>/` (project). The skill ships in this repo and in the npm package, but it is not registered until you install it.

**Global (all workspaces):**

```bash
npx skills add useprecedent/precedent -a cursor -g --skill precedent -y
```

**This repo only (from project root):**

```bash
npx skills add useprecedent/precedent -a cursor --skill precedent -y
```

Cloning **this** repository already includes `.cursor/skills/precedent/` (symlink to `SKILL.md`) so the skill is available in project scope without a global install.

Start a new Cursor chat (or reload the window) so the agent picks up the skill. Then ask about conflicting rules, effective policy, or invoke `/precedent` if your Cursor build exposes slash skills.

The skill runs the same compiler as the CLI and adds team rules and Cursor-settings user rules that are not on disk. See [SKILL.md](SKILL.md) for the full flow.

Internal slash commands (for example `/instruction-compiler`) can point at the same skill; the installed skill name is `precedent`.

### Session report vs CLI / Action

| Output | When | Includes settings user rules |
| --- | --- | --- |
| Skill **Effective instructions** | Cursor chat | Yes, when present in the session |
| CLI / Action Markdown | Local CI or `npx` | No, unless `--extra-rules` |

The skill uses sections **Conflicts**, **Unresolved**, and **Left out**. CLI and Action use the PR report schema (provenance, numbered findings). A worked monorepo example: [docs/session-report.md](docs/session-report.md).

## Inputs

**On disk (default compile):**

- `AGENTS.md` / `AGENTS.override.md` / `CLAUDE.md` / `CLAUDE.local.md` / `GEMINI.md` (repo root, nested paths, optional ancestors with `--no-ancestors` off)
- `.cursor/rules/*.mdc` — classified as always / glob / intelligent / manual
- `.claude/CLAUDE.md` and `.claude/rules/*.md` (Claude Code; `paths` frontmatter is glob)
- `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` (Copilot; `applyTo` is glob)
- `.cursor/skills/**/SKILL.md` and `.claude/skills/**/SKILL.md` — inventoried, not merged in v1
- User-home files when `--user-rules` is enabled (default for local CLI; off in the Action): `~/.cursor/rules`, `~/.claude/`, `~/.codex/`, `~/.copilot/`

Symlinks are recorded with `aliasOf` so duplicate paths are not separate authorities. Living merge order: [docs/precedence.md](docs/precedence.md).

**Not on disk:**

- Cursor team rules and settings-only user rules
- Copilot personal and organization instructions (GitHub UI)
- Claude Code managed settings

Pass chat-only rules without faking paths:

```bash
npx @useprecedent/precedent --root . --extra-rules extra-rules.json
```

`extra-rules.json` is a JSON array of `{ "layer": "team" | "user", "title": string, "text": string }`.

## Precedence (v1, always-on)

1. Team over project over user (Cursor layers; extra-rules from chat)
2. Among document files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, repo-wide Copilot instructions), higher specificity wins in the same chain; nested files apply only under `appliesUnder`. `.claude/` and `.github/` config directories count as the project root, not as nested app paths
3. Always-on project rules and covering documents in the same directory are one layer — conflicts there are **unresolved**, including Cursor `.mdc` vs `AGENTS.md` and Copilot instructions vs `AGENTS.md`
4. Glob, intelligent, manual, path-scoped Copilot/Claude rules, and skills are excluded from the merge in v1
5. `--ecosystem all` (default) compiles every inventoried always-on file. `--ecosystem cursor|claude-code|codex|copilot|gemini` leaves other ecosystems out of the merge

## CLI flags

| Flag | Effect |
| --- | --- |
| `--root` | Repository root (default: cwd) |
| `--path` | Path inside the repo to compile for (default: `.`) |
| `--compare <dir>` | Report only findings new vs another checkout |
| `--inventory` | Emit inventory JSON only |
| `--json` | Full report JSON |
| `--extra-rules <file>` | Team/user rules from session |
| `--ecosystem` | `all` (default) or one of `cursor`, `claude-code`, `codex`, `copilot`, `gemini` |
| `--no-user-rules` | Skip user-home instruction files |
| `--no-ancestors` | Skip ancestor instruction documents |
| `--fail-on-unresolved` | Exit 1 if unresolved always-on conflicts exist |

## Report format

CLI and Action share one Markdown schema ([docs/report-contract.md](docs/report-contract.md)). Empty PR deltas use a short note; PRs with new conflicts include full scope sections and numbered findings. Changing the schema is a major version.

Empty delta (typical Action comment):

```
# Precedent

practicelink/pl-cmp

Base a1b2c3d (main) · head e4f5g6h · [compare](https://github.com/practicelink/pl-cmp/compare/a1b2c3d...e4f5g6h)

Scope: always-on · team rules and Cursor settings user rules are not in this report.

No always-on conflicts in git on this head; none new relative to main.

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

Comment-only by default. Pin the release SHA (tag `v1.3` is the moving pointer for that line).

```yaml
name: Precedent
on:
  pull_request:
    paths:
      - "AGENTS.md"
      - "CLAUDE.md"
      - "GEMINI.md"
      - "**/AGENTS.md"
      - "**/CLAUDE.md"
      - "**/GEMINI.md"
      - "**/AGENTS.override.md"
      - ".cursor/rules/**"
      - ".claude/**"
      - ".github/copilot-instructions.md"
      - ".github/instructions/**"
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
      - uses: useprecedent/precedent@3972603746274e8c74b4e39e733b01b207e4c657 # v1.3
        with:
          fail-on-unresolved: false
```

The Action compiles from git only. Team rules and Cursor settings user rules are out of scope unless committed or passed via a custom workflow that supplies `--extra-rules`.

## Limits

- No proof that the model followed the effective policy
- Glob / intelligent / manual activation, path-scoped Copilot/Claude rules, and plugin skills are not merged in v1
- Semantic v1 is a local heuristic (no API calls in the default compile path)
- Copilot organization instructions and Cursor team rules are out of git compiles unless passed as `--extra-rules`

## Runtime

Compile and inventory run on the host running the CLI or Action. The default Action does not send repository content to a third-party Precedent service.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities through GitHub private advisory reporting.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
