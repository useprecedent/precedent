import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile, newFindings } from "./compile.ts";
import { defaultHome } from "./inventory.ts";
import { isEcosystem } from "./ecosystems.ts";
import { renderMarkdown, subjectFromRoot } from "./report.ts";
import type { CliOptions, ExtraRule } from "./types.ts";

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    root: process.cwd(),
    path: ".",
    home: defaultHome(),
    includeUserRules: true,
    includeAncestors: true,
    extraRules: [],
    ecosystem: "all",
    json: false,
    inventoryOnly: false,
    failOnUnresolved: false,
    compareRoot: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--root" && next) {
      options.root = resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--path" && next) {
      options.path = next;
      index += 1;
      continue;
    }
    if (arg === "--home" && next) {
      options.home = resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--inventory") {
      options.inventoryOnly = true;
      options.json = true;
      continue;
    }
    if (arg === "--fail-on-unresolved") {
      options.failOnUnresolved = true;
      continue;
    }
    if (arg === "--no-user-rules") {
      options.includeUserRules = false;
      continue;
    }
    if (arg === "--user-rules") {
      options.includeUserRules = true;
      continue;
    }
    if (arg === "--no-ancestors") {
      options.includeAncestors = false;
      continue;
    }
    if (arg === "--compare" && next) {
      options.compareRoot = resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--extra-rules" && next) {
      options.extraRules = readExtraRules(resolve(next));
      index += 1;
      continue;
    }
    if (arg === "--ecosystem" && next) {
      if (next !== "all" && !isEcosystem(next))
        throw new Error("--ecosystem must be all, cursor, claude-code, codex, copilot, or gemini");
      options.ecosystem = next === "all" ? "all" : next;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg && !arg.startsWith("-")) options.root = resolve(arg);
  }

  return options;
}

function readExtraRules(file: string): ExtraRule[] {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("--extra-rules must be a JSON array");
  return parsed.map((item, index) => {
    const row = item as Partial<ExtraRule>;
    if (row.layer !== "team" && row.layer !== "user")
      throw new Error(`extra rule ${index} needs layer team|user`);
    if (!row.text) throw new Error(`extra rule ${index} needs text`);
    return {
      layer: row.layer,
      title: row.title ?? `${row.layer} rule ${index + 1}`,
      text: row.text,
    };
  });
}

function printHelp(): void {
  process.stdout.write(`Precedent — compile the effective instruction set for a repository path

Usage:
  npx @useprecedent/precedent [root]
  python3 scripts/compile_instructions.py --root .

Options:
  --root <dir>             Workspace root (default: cwd)
  --path <repo-rel>        Path to compile for (default: .)
  --home <dir>             Home for user rules and ancestor stop
  --json                   Print the full report as JSON
  --inventory              Print the file inventory JSON the skill uses
  --compare <dir>          Only report findings new vs another compile root
  --extra-rules <file>     JSON array of team/user rules from chat (never on disk)
  --ecosystem <name>       all (default), cursor, claude-code, codex, copilot, gemini
  --user-rules             Include user-home instruction files (default locally)
  --no-user-rules          Skip user-home instruction files (default in CI)
  --no-ancestors           Skip instruction documents above the repo
  --fail-on-unresolved     Exit 1 when unresolved always-on conflicts exist
`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = compile(options);
  if (options.inventoryOnly) {
    process.stdout.write(
      `${JSON.stringify({ root: report.root, sources: report.sources, missingFromDisk: report.missingFromDisk }, null, 2)}\n`,
    );
    return;
  }
  const baseline = options.compareRoot
    ? compile({ ...options, root: options.compareRoot })
    : null;
  const delta = baseline ? newFindings(report, baseline) : null;
  const view = delta ? { ...report, ...delta } : report;
  if (options.json) {
    process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
  } else {
    process.stdout.write(
      renderMarkdown(report, {
        subject: subjectFromRoot(report.root),
        compilePath: options.path,
        mode: delta ? "pr_delta" : "full",
        baseRef: baseline ? subjectFromRoot(baseline.root) : undefined,
        provenance: delta
          ? { event: "local", baseRef: subjectFromRoot(baseline!.root) }
          : { event: "local" },
        delta: delta ?? undefined,
      }),
    );
  }
  if (options.failOnUnresolved && view.unresolved.length > 0) process.exit(1);
}

main();
