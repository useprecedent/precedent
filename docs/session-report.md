# Session report (Cursor skill)

The Cursor skill prints **Effective instructions** for the open workspace and the files this task touches. It is not the same artifact as the GitHub Action comment: the skill can include team rules and Cursor-settings user rules from the chat; the Action compiles git only unless you pass `--extra-rules`.

## How to run

Install once:

```bash
npx skills add useprecedent/precedent -a cursor -g --skill precedent -y
```

In Cursor, ask for effective policy, conflicting rules, or use your team slash command if you alias the skill (for example `/instruction-compiler` in an internal hub).

## Sections

| Section | Meaning |
| --- | --- |
| **Conflicts** | Two always-on instructions disagree; documented precedence picks a winner (project over user, team over project). |
| **Unresolved** | Same layer, no documented order (for example always-on `.mdc` vs covering `AGENTS.md` in one directory). The agent must ask before acting. |
| **Left out** | Real sources that are not in force for this task: nested `AGENTS.md` outside `appliesUnder`, glob/intelligent/manual/plugin rules, or contextual user rules (PR workflow, browser checks, and similar). |

When **Conflicts** is empty, the report should still say whether always-on instructions agree. **Left out** is expected on monorepos with per-app `AGENTS.md` files.

## Example (monorepo, redacted)

Real output from a work machine compiling a repo root task while nested app policies and plugin rules exist elsewhere:

```markdown
# Effective instructions

## Conflicts
### Skipping git hooks
- effective: Do not skip the Husky pre-push hook with `--no-verify`. (`.cursor/rules/verify-before-push.mdc`, project wins over a user rule; `CLAUDE.md` states the same rule)
- overridden: Skip hooks when the user explicitly requests it. (Cursor settings user rule: committing-changes-with-git)

### Force-push to main or master
- effective: Do not force-push, hard-reset, or rewrite published history unless Jake asks. (`CLAUDE.md`, project wins over a user rule)
- overridden: Never force-push to main or master; warn if asked. (Cursor settings user rule: committing-changes-with-git)

## Left out
- `apps/career-shell/AGENTS.md` — always, applies under `apps/career-shell`; this task does not work there
- `apps/cv-manager/AGENTS.md` — always, applies under `apps/cv-manager`; this task does not work there
- `apps/meded/AGENTS.md` — always, applies under `apps/meded`; this task does not work there
- `apps/meded/CLAUDE.md` — always, alias of `apps/meded/AGENTS.md`, so it is the same text and applies under `apps/meded`
- `…/plugins/…/rules/cloud-database.mdc` — requestable, Lovable Cloud Postgres is not this task
- `…/plugins/…/rules/lovable-workflow.mdc` — requestable, driving a Lovable project is not this task
- Cursor settings user rule: browser verification — applies when implementing or fixing a web application; this task does not
- Cursor settings user rule: creating-pull-requests — applies when creating a pull request; this task does not
```

CLI and Action JSON/Markdown use a different schema (PR provenance, numbered findings). See [README](../README.md#report-format).
