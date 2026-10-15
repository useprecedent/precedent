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

  it("inventories Copilot, Claude Code, Codex, and Gemini instruction files", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Shared agents file.");
    write(root, "GEMINI.md", "Gemini project file.");
    write(root, ".github/copilot-instructions.md", "Copilot repo-wide.");
    write(
      root,
      ".github/instructions/ts.instructions.md",
      "---\napplyTo: \"**/*.ts\"\n---\nTypeScript only.\n",
    );
    write(root, ".claude/CLAUDE.md", "Claude project file.");
    write(root, ".claude/rules/always.md", "Always-on Claude rule.");
    write(root, ".claude/rules/scoped.md", "---\npaths: src/**/*.ts\n---\nScoped Claude rule.\n");
    write(root, ".cursor/skills/demo/SKILL.md", "A requestable skill.");
    write(root, ".cursor/skills/demo.claude/SKILL.md", "Cursor skill whose folder name contains .claude.");
    write(root, ".claude/skills/demo/SKILL.md", "Claude Code skill.");
    write(root, "AGENTS.override.md", "Codex override.");

    const sources = collectInventory({
      root,
      home: root,
      includeUserRules: false,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const byPath = Object.fromEntries(sources.map((source) => [source.path, source]));

    assert.equal(byPath[".github/copilot-instructions.md"]?.kind, "copilot-instructions");
    assert.equal(byPath[".github/copilot-instructions.md"]?.activation, "always");
    assert.equal(byPath[".github/copilot-instructions.md"]?.appliesUnder, null);
    assert.equal(byPath[".github/instructions/ts.instructions.md"]?.activation, "glob");
    assert.deepEqual(byPath[".github/instructions/ts.instructions.md"]?.globs, ["**/*.ts"]);
    assert.equal(byPath[".claude/CLAUDE.md"]?.kind, "claude-md");
    assert.equal(byPath[".claude/CLAUDE.md"]?.appliesUnder, null);
    assert.equal(byPath[".claude/rules/always.md"]?.kind, "claude-rule");
    assert.equal(byPath[".claude/rules/always.md"]?.activation, "always");
    assert.equal(byPath[".claude/rules/scoped.md"]?.activation, "glob");
    assert.equal(byPath["GEMINI.md"]?.kind, "gemini-md");
    assert.equal(byPath["AGENTS.override.md"]?.kind, "agents-md");
    assert.deepEqual(byPath["AGENTS.override.md"]?.ecosystems, ["codex"]);
    assert.equal(byPath[".cursor/skills/demo/SKILL.md"]?.kind, "skill");
    assert.equal(byPath[".cursor/skills/demo/SKILL.md"]?.activation, "manual");
    assert.deepEqual(byPath[".cursor/skills/demo.claude/SKILL.md"]?.ecosystems, ["cursor"]);
    assert.deepEqual(byPath[".claude/skills/demo/SKILL.md"]?.ecosystems, ["claude-code"]);
    assert.ok(byPath["AGENTS.md"]?.ecosystems.includes("codex"));
    assert.ok(byPath["AGENTS.md"]?.ecosystems.includes("copilot"));
  });

  it("reads user-home files for Claude Code, Codex, and Copilot", () => {
    const home = tempDir("precedent-home-");
    const root = tempDir("precedent-root-");
    write(home, ".claude/CLAUDE.md", "User Claude file.");
    write(home, ".codex/AGENTS.md", "User Codex file.");
    write(home, ".copilot/copilot-instructions.md", "User Copilot file.");
    write(root, "README.md", "empty\n");

    const sources = collectInventory({
      root,
      home,
      includeUserRules: true,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const kinds = sources.map((source) => source.kind).sort();
    assert.ok(kinds.includes("claude-md"));
    assert.ok(kinds.includes("agents-md"));
    assert.ok(kinds.includes("copilot-instructions"));
    assert.ok(sources.some((source) => source.layer === "user" && source.kind === "claude-md"));
    const userCodex = sources.find((source) => source.kind === "agents-md" && source.layer === "user");
    assert.deepEqual(userCodex?.ecosystems, ["codex"]);
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
