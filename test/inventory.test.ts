import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { compile } from "../src/compile.ts";
import { collectInventory } from "../src/inventory.ts";
import { link, options, tempDir, write } from "./helpers.ts";

describe("inventory", () => {
  it("finds AGENTS.md, CLAUDE.md, and .cursor/rules without walking node_modules", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root agents.");
    write(root, "apps/meded/AGENTS.md", "Nested agents.");
    write(root, ".cursor/rules/always.mdc", "---\nalwaysApply: true\n---\nAlways on.\n");
    write(root, ".cursor/rules/glob.mdc", "---\nglobs: **/*.ts\n---\nGlob rule.\n");
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "pkg", "AGENTS.md"), "Should be ignored.");

    const sources = collectInventory({
      root,
      home: root,
      includeUserRules: false,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const paths = sources.map((source) => source.path);

    assert.ok(paths.includes("AGENTS.md"));
    assert.ok(paths.includes("apps/meded/AGENTS.md"));
    assert.ok(paths.includes(".cursor/rules/always.mdc"));
    assert.ok(paths.includes(".cursor/rules/glob.mdc"));
    assert.equal(paths.some((path) => path.includes("node_modules")), false);
  });

  it("classifies mdc activation and marks symlink aliases", () => {
    const root = tempDir();
    write(root, "apps/meded/AGENTS.md", "Nested agents file.");
    link(root, "apps/meded/CLAUDE.md", "AGENTS.md");
    write(root, ".cursor/rules/intel.mdc", "---\ndescription: Use for API work\n---\nIntelligent.\n");
    write(root, ".cursor/rules/manual.mdc", "Manual only.\n");

    const sources = collectInventory({
      root,
      home: root,
      includeUserRules: false,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const byPath = Object.fromEntries(sources.map((source) => [source.path, source]));

    assert.equal(byPath[".cursor/rules/intel.mdc"]?.activation, "intelligent");
    assert.equal(byPath[".cursor/rules/manual.mdc"]?.activation, "manual");
    assert.equal(byPath["apps/meded/CLAUDE.md"]?.aliasOf, "AGENTS.md");
    assert.equal(byPath["apps/meded/AGENTS.md"]?.kind, "agents-md");
    assert.equal(byPath["apps/meded/AGENTS.md"]?.appliesUnder, "apps/meded");
  });

  it("does not treat a symlink as a second authority in the compile", () => {
    const root = tempDir();
    write(root, "apps/meded/AGENTS.md", "The agent runs terminal commands for this app.");
    link(root, "apps/meded/CLAUDE.md", "AGENTS.md");

    const report = compile(options(root, "apps/meded"));
    const left = report.leftOut.find((item) => item.path === "apps/meded/CLAUDE.md");
    assert.ok(left);
    assert.match(left.reason, /symlink alias/);
  });
});
