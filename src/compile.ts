import { resolve } from "node:path";
import { collectInventory } from "./inventory.ts";
import { selectInForce } from "./precedence.ts";
import { findSemanticConflicts } from "./semantic.ts";
import { extractStatements } from "./statements.ts";
import type { CompileOptions, Report } from "./types.ts";

export function compile(options: CompileOptions): Report {
  const root = resolve(options.root);
  const path = resolve(root, options.path);
  const inventory = collectInventory({
    root,
    home: options.home,
    includeUserRules: options.includeUserRules,
    includeAncestors: options.includeAncestors,
    extraRules: options.extraRules,
  });
  const { inForce, leftOut } = selectInForce(inventory.sources, root, path);
  const statements = extractStatements(inForce);
  const findings = findSemanticConflicts(inForce, statements);

  return {
    product: "precedent",
    version: 1,
    root: inventory.root,
    path,
    sources: inventory.sources,
    missingFromDisk: inventory.missingFromDisk,
    inForce,
    leftOut,
    conflicts: findings.filter((item) => item.resolution === "override"),
    unresolved: findings.filter((item) => item.resolution === "unresolved"),
    labels: {
      measured: "file inventory, activation, symlink aliases, and documented layer/specificity order",
      inferred: "semantic contradiction on always-on statements; paraphrases of the same action are not a conflict",
    },
  };
}

export function newFindings(current: Report, baseline: Report): {
  conflicts: Report["conflicts"];
  unresolved: Report["unresolved"];
} {
  const seen = new Set([
    ...baseline.conflicts.map(fingerprint),
    ...baseline.unresolved.map(fingerprint),
  ]);
  return {
    conflicts: current.conflicts.filter((item) => !seen.has(fingerprint(item))),
    unresolved: current.unresolved.filter((item) => !seen.has(fingerprint(item))),
  };
}

function fingerprint(conflict: Report["conflicts"][number]): string {
  const paths = conflict.statements
    .map((statement) => `${statement.path}:${statement.line}:${statement.text}`)
    .sort()
    .join("|");
  return `${conflict.behavior}|${conflict.resolution}|${paths}`;
}
