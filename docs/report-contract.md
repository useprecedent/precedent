# Report contract

CLI Markdown and the GitHub Action comment share one schema. Changing this document is a report-schema break and requires a major version.

The Action comment is the product surface. Keep `<!-- precedent-report -->` and update that comment in place.

## Fields

| Field | Rule |
| --- | --- |
| Title | `# Precedent` only |
| Subject | `owner/repo` from GitHub context, or the directory basename locally. Never a runner path such as `/home/runner/work/...` |
| Provenance | Event, base SHA (short), head SHA (short), compare URL when compiling a pull request |
| Scope | Full form: `always-on` · compile path when it is not `.` · `Ecosystems:` listing unique in-force source ecosystems when any exist · source counts. Nested files are path-scoped, not ignored. Session-only team and settings user rules are named as out of this report. Compact empty PR deltas omit `Ecosystems:` and use one scope line |
| Findings | Numbered. Each line: behavior, kind (`conflict` or `unresolved`), citations `path:line`, label `measured` or `inferred` |
| Empty PR delta | `No always-on conflicts in git on this head; none new relative to {base}.` Then one line stating that team rules and Cursor settings user rules are not in this report |
| Methodology | A `<details>` block at the bottom. Measured vs inferred. No closing slogan |
| Idempotence | Marker `<!-- precedent-report -->`. One comment per pull request |

## Labels

- **measured** — file inventory, activation classification, symlink aliases, documented layer and specificity order
- **inferred** — semantic contradiction on always-on statements; paraphrases of the same action are not a conflict

This report does not prove model compliance.

## Empty vs findings

An empty pull-request delta uses a short form (title, subject, one provenance line, one scope line, empty finding line, methodology). That compact scope line does not include `Ecosystems:`.

A compile with new conflicts uses the full sections: Provenance, Scope, Findings, methodology.
