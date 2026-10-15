# Gold Action comment

Live GitHub Action comment on `practicelink/pl-cmp` (follow-up PR vs `develop`, 2026-10-15). Semantic v1 cited an unresolved always-on clash: who runs terminal commands.

Screenshot: [gold-action-comment.png](gold-action-comment.png)

The Markdown below matches the Action renderer (`src/report.ts`) for a PR with new findings. Empty-delta comments stay compact; see `test/fixtures/golden-pr-comment-empty.md`.

```markdown
<!-- precedent-report -->

# Precedent

practicelink/pl-cmp

## Provenance

- Event: pull_request
- Base: 181cb96 (develop)
- Head: 3437722
- Compare: [compare](https://github.com/practicelink/pl-cmp/compare/181cb96...3437722)

## Scope

- Activation: always-on
- Ecosystems: claude-code, codex, copilot, cursor
- Sources: 11 on disk, 6 in force
- Excluded from merge: 5 sources (glob, intelligent, manual, or outside compile path)
- Out of this report: team rules; user rules stored in Cursor settings; Copilot personal and organization instructions (GitHub UI); Claude Code managed settings

## Findings

1. **who runs terminal commands** (`unresolved`, inferred)
   - statement: The user runs terminal commands. (`.cursor/rules/user-runs-commands.mdc:1`)
   - statement: The agent runs terminal commands required to inspect, test, and verify. Do not ask the user to run them. (`.cursor/rules/agent-runs-commands.mdc:1`)

<details>
<summary>Methodology</summary>

**Measured:** file inventory, activation classification, symlink aliases, and documented layer/specificity order.

**Inferred:** semantic contradiction on always-on statements. Paraphrases of the same action are not a conflict.

This report does not prove model compliance.
</details>
```
