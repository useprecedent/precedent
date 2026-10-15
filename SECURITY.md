# Security

Report vulnerabilities privately. Do not open a public issue for a suspected security problem.

## Report

Use [GitHub private vulnerability reporting](https://github.com/useprecedent/precedent/security/advisories/new) on this repository.

Include:

- Precedent version (npm package, Action ref, or git SHA)
- What the compiler read or wrote that should not have been exposed
- A minimal reproduction when you can share one without secrets

## Scope

Precedent inventories instruction files and prints a report. Those files can contain secrets. The compiler redacts common token patterns before a report is written, and it does not send repository contents to a Precedent-hosted service in the default CLI or Action path.

Out of scope for this document: whether a model followed the compiled policy.

## Response

The maintainer will acknowledge a valid report and ship a fix on the next patch release when the issue is in this repository.
