<p align="center">
  <img src="brand/mark.png" alt="Precedent" width="64" height="64" />
</p>

# Precedent

Instruction files for coding agents often disagree. Precedent finds them for a path in the repo, applies the order vendors have documented, and reports which statements should win.

## What it does

Your agent does not read one rulebook. It can pick up `AGENTS.md`, Cursor rules, `CLAUDE.md`, Copilot instructions, Gemini files, plugin rules, and copies of those in your home folder — at the same time. Two of them can say opposite things. Example: “the agent runs terminal commands” vs “you will run every command.”

Precedent answers three questions for this path:

1. **Which instructions are in force?** It finds the files, keeps the ones that always apply, and drops the ones that only apply to some globs, skills, or nested apps.
2. **When they disagree, who wins?** Team over project over user. A nested `AGENTS.md` applies only under its directory. If two files at the same layer disagree and the vendor has not published an order, that is **unresolved** — the agent should ask before doing that thing.
3. **What was skipped?** **Left out** lists files that exist but are not in force here, so you can see a rule was found and why it did not apply.

You run it as a [CLI](#install-cli), a [GitHub Action](#github-action) comment on pull requests, or a [skill](#use-with-your-coding-tool) inside Cursor, Claude Code, Codex, Copilot, or Gemini. Markdown for people and PRs; JSON for automation.

Precedent does not watch the model. A clean report means the files have a documented winner, not that the agent obeyed it.

## Components

| Interface | Role |
| --- | --- |
| CLI | `npx @useprecedent/precedent` — report or JSON |
| GitHub Action | PR comment on policy file changes; optional `fail-on-unresolved` |
| Skill | Same compile flow inside Cursor, Claude Code, Codex, Copilot, or Gemini ([SKILL.md](SKILL.md)) |

**Measured:** file inventory, activation mode, symlinks, documented layer/specificity.

**Inferred:** semantic contradiction between always-on statements (paraphrases of the same action are not conflicts).

## Use with your coding tool

| You use… | Install the skill (global) | Leave other ecosystems out |
| --- | --- | --- |
| [Cursor](#cursor) | `npx skills add useprecedent/precedent -a cursor -g --skill precedent -y` | `--ecosystem cursor` |
| [Claude Code](#claude-code) | `npx skills add useprecedent/precedent -a claude-code -g --skill precedent -y` | `--ecosystem claude-code` |
| [Codex](#codex) | `npx skills add useprecedent/precedent -a codex -g --skill precedent -y` | `--ecosystem codex` |
| [GitHub Copilot](#github-copilot) | `npx skills add useprecedent/precedent -a github-copilot -g --skill precedent -y` | `--ecosystem copilot` |
| [Gemini CLI](#gemini-cli) | `npx skills add useprecedent/precedent -a gemini-cli -g --skill precedent -y` | `--ecosystem gemini` |
| Scripts, CI, or no skill | — | [CLI](#install-cli) (default `--ecosystem all`) |
| PR comments when instruction files change | — | [GitHub Action](#github-action) |

Drop `-g` to install for this repository only. Without `-g`, the skills CLI writes Claude Code to `.claude/skills/precedent/` and Cursor, Codex, Copilot, and Gemini CLI to `.agents/skills/precedent/`. The skill ships in this repo and in the npm package; it is not registered in your agent until you install it.

The skills CLI `-a` name and Precedent `--ecosystem` name are not always the same (`github-copilot` vs `copilot`, `gemini-cli` vs `gemini`).

### In a session

1. Install the skill for your agent (table above).
2. Start a new session so the agent loads it. Claude Code also accepts `/reload-skills`.
3. Ask about effective policy or conflicting rules, or invoke `/precedent` if your agent exposes slash skills.
4. The agent runs the compiler, prints **Conflicts** / **Unresolved** / **Left out**, and follows the winners. If **Unresolved** is non-empty, it should ask which statement to follow before doing that thing.

The skill runs the same compiler as the CLI. After the file compile, it adds chat-only rules that are not on disk when those appear in the session (Cursor team/settings rules, Claude managed settings, Copilot GitHub UI instructions). The CLI `--extra-rules` flag is the same escape hatch for automation, but those entries are Cursor-layer sources and only join `--ecosystem all` and `--ecosystem cursor` compiles.

See [SKILL.md](SKILL.md) for the full flow. A worked monorepo example: [docs/session-report.md](docs/session-report.md).

Internal slash commands (for example `/instruction-compiler`) can point at the same skill; the installed skill name is `precedent`.

**Where the skill lands (`-g`):**

| Agent | Path |
| --- | --- |
| Cursor | `~/.cursor/skills/precedent/` |
| Claude Code | `~/.claude/skills/precedent/` |
| Codex | `~/.agents/skills/precedent/` |
| GitHub Copilot | `~/.copilot/skills/precedent/` |
| Gemini CLI | `~/.gemini/skills/precedent/` |

Cloning **this** repository already includes `.cursor/skills/precedent/` (symlink to `SKILL.md`).

### Cursor

```bash
npx skills add useprecedent/precedent -a cursor -g --skill precedent -y
```

Reload the window or start a new chat. Ask about effective policy or conflicting rules, or invoke `/precedent`.

```bash
npx @useprecedent/precedent --root . --ecosystem cursor
```

Always-on in a `--ecosystem cursor` compile: always-on `.cursor/rules/*.mdc`, always-on Cursor plugin rules (`.cursor/plugins/**/rules`, `.cursor-plugin` packs, `~/.cursor/plugins/local`), `AGENTS.md`, root `CLAUDE.md` (not `.claude/CLAUDE.md`), and `~/.cursor/rules`. Glob, intelligent, and manual `.mdc` files, requestable plugin rules, and skills stay out of v1 until a task matches them.

Cursor-only: after the file compile, the skill adds team rules and settings-only user rules from this chat. Files under `~/.cursor/rules` are already inventoried as user rules.

### Claude Code

```bash
npx skills add useprecedent/precedent -a claude-code -g --skill precedent -y
```

Start a new session or run `/reload-skills`. Ask the same questions or type `/precedent`.

```bash
npx @useprecedent/precedent --root . --ecosystem claude-code
```

Always-on in a `--ecosystem claude-code` compile: `AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md`, always-on `.claude/rules/*.md`, `CLAUDE.local.md` (user layer), `~/.claude/CLAUDE.md`, and `~/.claude/rules/`. Path-scoped `.claude/rules` (`paths` frontmatter) stay out of v1. Managed and enterprise settings are not on disk.

### Codex

```bash
npx skills add useprecedent/precedent -a codex -g --skill precedent -y
```

Start a new Codex session, then ask about effective policy or conflicting rules.

```bash
npx @useprecedent/precedent --root . --ecosystem codex
```

Always-on in a `--ecosystem codex` compile: `AGENTS.md` / `AGENTS.override.md` in the repo (and ancestors), plus `~/.codex/AGENTS.md` or `~/.codex/AGENTS.override.md`. `AGENTS.md` is also in the Cursor, Claude Code, and Copilot ecosystems; `AGENTS.override.md` is Codex-only. Precedent does not emulate Codex concatenation or the 32 KiB cap.

### GitHub Copilot

```bash
npx skills add useprecedent/precedent -a github-copilot -g --skill precedent -y
```

Start a new Copilot session, then ask about effective policy or conflicting rules.

```bash
npx @useprecedent/precedent --root . --ecosystem copilot
```

Always-on in a `--ecosystem copilot` compile: `.github/copilot-instructions.md`; `AGENTS.md`; `CLAUDE.md` / `.claude/CLAUDE.md`; `GEMINI.md`; always-on `.claude/rules/*.md`; and `~/.copilot/` when user rules are on. Path-scoped `.github/instructions/**/*.instructions.md` (`applyTo`) stay out of v1. Personal and organization instructions from the GitHub UI are not on disk.

### Gemini CLI

```bash
npx skills add useprecedent/precedent -a gemini-cli -g --skill precedent -y
```

Start a new Gemini CLI session, then ask about effective policy or conflicting rules.

```bash
npx @useprecedent/precedent --root . --ecosystem gemini
```

Always-on in a `--ecosystem gemini` compile: `GEMINI.md` at the repo root, nested copies, and ancestors. Copilot also inventories `GEMINI.md`; it stays in a `--ecosystem copilot` compile.

### Without a skill

Ask the agent to run the CLI, or run it yourself:

```bash
npx @useprecedent/precedent --root .
npx @useprecedent/precedent --root . --ecosystem claude-code
```

### Session report vs CLI / Action

| Output | When | Includes chat-only rules |
| --- | --- | --- |
| Skill **Effective instructions** | Agent session | Yes, when the agent can see them (Cursor team/settings rules in Cursor chat) |
| CLI / Action Markdown | Local CI or `npx` | Only via `--extra-rules`, and only in `all` / `cursor` compiles |

The skill uses sections **Conflicts**, **Unresolved**, and **Left out**. CLI and Action use the PR report schema (provenance, numbered findings).

## Install (CLI)

```bash
npx @useprecedent/precedent
```

```bash
npx @useprecedent/precedent --root . --json
npx @useprecedent/precedent --root . --inventory
npx @useprecedent/precedent --root . --ecosystem cursor
```

Node 22+. Inventory JSON is also available from Python (same shape as the skill script):

```bash
python3 scripts/compile_instructions.py --root .
```

## Inputs

**On disk (default compile):**

- `AGENTS.md` / `AGENTS.override.md` / `CLAUDE.md` / `CLAUDE.local.md` / `GEMINI.md` (repo root, nested paths, optional ancestors with `--no-ancestors` off)
- `.cursor/rules/*.mdc` — classified as always / glob / intelligent / manual
- `.claude/CLAUDE.md` and `.claude/rules/*.md` (Claude Code; `paths` frontmatter is glob)
- `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` (Copilot; `applyTo` is glob)
- Skills (`SKILL.md` under `.cursor/skills`, `.claude/skills`, `.agents/skills`, `.copilot/skills`, `.gemini/skills`, and plugin `skills/` dirs including `~/.cursor/plugins/local`) — inventoried; requestable, not merged unless the task matches. Frontmatter `description` is description-gated; `disable-model-invocation: true` stays named-only even when a description is set
- Cursor plugin rules: `.cursor/plugins/**/rules/*.{mdc,md}`, and `rules/` next to a `.cursor-plugin` pack. Always-on plugin rules join the merge; glob / intelligent / manual plugin rules stay out of v1
- User-home files when `--user-rules` is enabled (default for local CLI; off in the Action): `~/.cursor/rules`, `~/.cursor/skills`, `~/.cursor/plugins/local`, `~/.claude/`, `~/.agents/skills`, `~/.codex/`, `~/.copilot/`, `~/.gemini/skills`. `~/.cursor/skills-cursor` and `~/.cursor/plugins/cache` are not inventoried

Symlinks are recorded with `aliasOf` so duplicate paths are not separate authorities. Living merge order: [docs/precedence.md](docs/precedence.md).

**Not on disk:**

- Cursor team rules and settings-only user rules
- Copilot personal and organization instructions (GitHub UI)
- Claude Code managed settings
- Cursor marketplace plugins (which cached plugins apply to this workspace)

Pass chat-only rules without faking paths:

```bash
npx @useprecedent/precedent --root . --extra-rules extra-rules.json
```

`extra-rules.json` is a JSON array of `{ "layer": "team" | "user", "title": string, "text": string }`. Those entries are tagged as Cursor-layer sources. They participate in `--ecosystem all` and `--ecosystem cursor` compiles only.

## Precedence (v1, always-on)

1. Team over project over user (Cursor layers; extra-rules from chat)
2. Among document files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, repo-wide Copilot instructions), higher specificity wins in the same chain; nested files apply only under `appliesUnder`. `.claude/` and `.github/` config directories count as the project root, not as nested app paths
3. Always-on project rules and covering documents in the same directory are one layer — conflicts there are **unresolved**, including Cursor `.mdc` vs `AGENTS.md` and Copilot instructions vs `AGENTS.md`
4. Glob, intelligent, manual, path-scoped Copilot/Claude rules, and requestable skills/plugin rules are excluded from the merge in v1. Always-on plugin rules join the merge; clash with covering `AGENTS.md` / `CLAUDE.md` at the same layer is unresolved
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

Live finding comment (screenshot + transcript): [docs/gold-action-comment.md](docs/gold-action-comment.md).

Empty delta (typical Action comment):

```
# Precedent

demonslayer/hashira

Base a1b2c3d (main) · head e4f5g6h · [compare](https://github.com/demonslayer/hashira/compare/a1b2c3d...e4f5g6h)

Scope: always-on · team rules and Cursor settings user rules are not in this report.

No always-on conflicts in git on this head; none new relative to main.

<details>
<summary>Methodology</summary>
...
</details>
```

New conflict on a PR (live finding, abbreviated):

```
## Findings

1. **who runs terminal commands** (`unresolved`, inferred)
   - statement: The user runs terminal commands. (`.cursor/rules/user-runs-commands.mdc:1`)
   - statement: The agent runs terminal commands required to inspect, test, and verify. Do not ask the user to run them. (`.cursor/rules/agent-runs-commands.mdc:1`)
```

## GitHub Action

Comment-only by default. Pin the release SHA (tag `v1.5` is the moving pointer for that line).

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
      - ".cursor/plugins/**"
      - "**/.cursor-plugin/**"
      - "**/*.mdc"
      - "**/rules/*.md"
      - "**/rules/*.markdown"
      - ".cursor/skills/**"
      - ".agents/skills/**"
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
      - uses: useprecedent/precedent@03f2eff0264e84c8d6a5be14c36732596d49fb23 # v1.5
        with:
          fail-on-unresolved: false
```

The Action compiles from git only. Team rules and Cursor settings user rules are out of scope unless committed or passed via a custom workflow that supplies `--extra-rules`. `.cursor/plugins/**` watches in-repo plugin rules and plugin skills. Pack rule files live in a sibling `rules/` directory, which GitHub path filters cannot bind to `.cursor-plugin`; `**/*.mdc`, `**/rules/*.md`, and `**/rules/*.markdown` watch those rule files, and `**/.cursor-plugin/**` watches pack metadata. `**/rules/*.md` can also match unrelated markdown under a `rules/` folder.

## Limits

- No proof that the model followed the effective policy
- Glob / intelligent / manual activation, path-scoped Copilot/Claude rules, and requestable skills/plugin rules are not merged in v1. Skills with `disable-model-invocation: true` stay named-only
- Cursor marketplace plugin cache is not inventoried
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
