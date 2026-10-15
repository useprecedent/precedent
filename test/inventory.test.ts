import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { kindFor } from "../src/ecosystems.ts";
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
    write(root, ".github/instructions/general.instructions.md", "No applyTo frontmatter.\n");
    write(root, ".claude/CLAUDE.md", "Claude project file.");
    write(root, ".claude/rules/always.md", "Always-on Claude rule.");
    write(root, ".claude/rules/scoped.md", "---\npaths: src/**/*.ts\n---\nScoped Claude rule.\n");
    write(root, ".cursor/skills/demo/SKILL.md", "A requestable skill.");
    write(root, ".cursor/skills/demo.claude/SKILL.md", "Cursor skill whose folder name contains .claude.");
    write(root, ".claude/skills/demo/SKILL.md", "Claude Code skill.");
    write(root, ".agents/skills/shared/SKILL.md", "Shared agents skill.");
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
    assert.equal(byPath[".github/instructions/general.instructions.md"]?.activation, "glob");
    assert.deepEqual(byPath[".github/instructions/general.instructions.md"]?.globs, []);
    assert.equal(byPath[".claude/CLAUDE.md"]?.kind, "claude-md");
    assert.deepEqual(byPath[".claude/CLAUDE.md"]?.ecosystems, ["claude-code", "copilot"]);
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
    assert.deepEqual(byPath[".agents/skills/shared/SKILL.md"]?.ecosystems, ["cursor", "codex", "copilot", "gemini"]);
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
    const userClaude = sources.find((source) => source.kind === "claude-md" && source.layer === "user");
    assert.deepEqual(userClaude?.ecosystems, ["claude-code", "copilot"]);
    const userCodex = sources.find((source) => source.kind === "agents-md" && source.layer === "user");
    assert.deepEqual(userCodex?.ecosystems, ["codex"]);
  });

  it("treats CLAUDE.local.md as user layer so project CLAUDE.md wins", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "The agent runs terminal commands. Do not ask the user to run them.\n");
    write(root, "CLAUDE.local.md", "I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n");

    const sources = collectInventory({
      root,
      home: root,
      includeUserRules: false,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const byPath = Object.fromEntries(sources.map((source) => [source.path, source]));
    assert.equal(byPath["CLAUDE.local.md"]?.layer, "user");
    assert.deepEqual(byPath["CLAUDE.local.md"]?.ecosystems, ["claude-code"]);
    assert.equal(byPath["CLAUDE.md"]?.layer, "project");

    const report = compile(options(root));
    assert.equal(report.unresolved.length, 0);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0]?.effective?.layer, "project");
  });

  it("inventories plugin rules, plugin skills, and user-home skills", () => {
    const home = tempDir("precedent-home-");
    const root = tempDir("precedent-root-");
    write(
      root,
      ".cursor/plugins/ship/rules/always.mdc",
      "---\nalwaysApply: true\n---\nBind HTTP servers to 0.0.0.0.\n",
    );
    write(
      root,
      ".cursor/plugins/ship/rules/requestable.mdc",
      "---\ndescription: Use when deploying to ship\n---\nShip deploy notes.\n",
    );
    write(root, ".cursor/plugins/ship/skills/deploy/SKILL.md", "---\nname: deploy\ndescription: Deploy the app\n---\nDeploy skill.\n");
    write(root, "pack/.cursor-plugin/plugin.json", "{\"name\":\"pack\"}\n");
    write(root, "pack/rules/always.mdc", "---\nalwaysApply: true\n---\nPack always-on plugin rule.\n");
    write(home, ".cursor/skills/personal/SKILL.md", "Personal cursor skill.");
    write(home, ".cursor/skills-cursor/builtin/SKILL.md", "Built-in skill must be ignored.");
    write(
      home,
      ".cursor/plugins/local/acme/rules/local-always.mdc",
      "---\nalwaysApply: true\n---\nLocal plugin always-on rule.\n",
    );
    write(
      home,
      ".cursor/plugins/cache/marketplace/rules/cache-always.mdc",
      "---\nalwaysApply: true\n---\nCache plugin must not be inventoried.\n",
    );
    write(root, "README.md", "empty\n");

    const sources = collectInventory({
      root,
      home,
      includeUserRules: true,
      includeAncestors: false,
      extraRules: [],
    }).sources;
    const byPath = Object.fromEntries(sources.map((source) => [source.path, source]));

    assert.equal(byPath[".cursor/plugins/ship/rules/always.mdc"]?.kind, "plugin-rule");
    assert.equal(byPath[".cursor/plugins/ship/rules/always.mdc"]?.activation, "always");
    assert.equal(byPath[".cursor/plugins/ship/rules/always.mdc"]?.layer, "project");
    assert.ok(byPath[".cursor/plugins/ship/rules/always.mdc"]?.body?.includes("Bind HTTP servers"));
    assert.equal(byPath[".cursor/plugins/ship/rules/requestable.mdc"]?.activation, "intelligent");
    assert.equal(byPath[".cursor/plugins/ship/skills/deploy/SKILL.md"]?.kind, "skill");
    assert.equal(byPath[".cursor/plugins/ship/skills/deploy/SKILL.md"]?.activation, "intelligent");
    assert.equal(byPath["pack/rules/always.mdc"]?.kind, "plugin-rule");
    assert.equal(kindFor(join(root, "pack/rules/always.mdc")), "plugin-rule");
    assert.equal(kindFor(join(root, ".cursor/plugins/ship/rules/always.mdc")), "plugin-rule");
    assert.equal(byPath["pack/rules/always.mdc"]?.activation, "always");
    const personal = sources.find((source) => source.path.endsWith("skills/personal/SKILL.md") || source.path.endsWith("skills\\personal\\SKILL.md"));
    assert.ok(personal);
    assert.equal(personal.layer, "user");
    assert.equal(personal.kind, "skill");
    const localPlugin = sources.find((source) => source.path.includes("local-always.mdc"));
    assert.ok(localPlugin);
    assert.equal(localPlugin.kind, "plugin-rule");
    assert.equal(localPlugin.layer, "user");
    assert.equal(localPlugin.activation, "always");
    assert.equal(sources.some((source) => source.path.includes("skills-cursor")), false);
    assert.equal(sources.some((source) => source.path.includes("cache-always.mdc")), false);
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
