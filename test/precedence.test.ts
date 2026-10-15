import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compile } from "../src/compile.ts";
import { options, tempDir, write } from "./helpers.ts";

describe("precedence", () => {
  it("leaves glob, intelligent, and manual rules out of always-on v1", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root policy is always on.");
    write(root, ".cursor/rules/glob.mdc", "---\nglobs: **/*.ts\n---\nOnly for TypeScript.\n");
    write(root, ".cursor/rules/intel.mdc", "---\ndescription: Use when writing SQL\n---\nSQL notes.\n");
    write(root, ".cursor/rules/manual.mdc", "Named only.\n");

    const report = compile(options(root));
    const activations = report.leftOut.map((item) => item.activation).sort();
    assert.deepEqual(activations, ["glob", "intelligent", "manual"]);
  });

  it("lets a team rule win over a user rule for the same behavior", () => {
    const root = tempDir();
    write(root, "README.md", "empty repo\n");

    const report = compile({
      ...options(root),
      extraRules: [
        { layer: "user", title: "user settings", text: "I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT." },
        { layer: "team", title: "team rule", text: "The agent runs terminal commands. Do not ask the user to run them." },
      ],
    });

    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0]?.effective?.layer, "team");
    assert.equal(report.unresolved.length, 0);
  });

  it("leaves Copilot path instructions without applyTo out of the always-on merge", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "The agent runs terminal commands. Do not ask the user to run them.\n");
    write(
      root,
      ".github/instructions/general.instructions.md",
      "I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const report = compile(options(root));
    const pathInstructions = report.leftOut.find((item) => item.path === ".github/instructions/general.instructions.md");
    assert.ok(pathInstructions);
    assert.equal(pathInstructions.activation, "glob");
    assert.equal(report.inForce.some((item) => item.path === ".github/instructions/general.instructions.md"), false);
    assert.equal(report.unresolved.length, 0);
  });

  it("leaves requestable skills out of the always-on merge", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root policy is always on.");
    write(root, ".cursor/skills/demo/SKILL.md", "Only when the skill is named.");

    const report = compile(options(root));
    const skill = report.leftOut.find((item) => item.path === ".cursor/skills/demo/SKILL.md");
    assert.ok(skill);
    assert.match(skill.reason, /skill/);
    assert.equal(report.inForce.some((item) => item.kind === "skill"), false);
  });

  it("merges always-on plugin rules and leaves requestable plugin sources out", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root policy is always on.");
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
    write(
      root,
      ".cursor/plugins/ship/skills/deploy/SKILL.md",
      "---\nname: deploy\ndescription: Deploy the app\n---\nDeploy skill.\n",
    );

    const report = compile(options(root));
    assert.ok(report.inForce.some((item) => item.path === ".cursor/plugins/ship/rules/always.mdc"));
    const requestable = report.leftOut.find((item) => item.path === ".cursor/plugins/ship/rules/requestable.mdc");
    assert.ok(requestable);
    assert.match(requestable.reason, /plugin rule/);
    const skill = report.leftOut.find((item) => item.path === ".cursor/plugins/ship/skills/deploy/SKILL.md");
    assert.ok(skill);
    assert.match(skill.reason, /skill/);
  });

  it("treats always-on plugin rules and covering AGENTS.md as one unresolved layer", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "The agent runs terminal commands. Do not ask the user to run them.\n");
    write(
      root,
      ".cursor/plugins/ship/rules/commands.mdc",
      "---\nalwaysApply: true\n---\nI (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const report = compile(options(root));
    assert.equal(report.conflicts.length, 0);
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "who runs terminal commands");
  });

  it("lets a project covering document win over a user-local always-on plugin rule", () => {
    const home = tempDir("precedent-home-");
    const root = tempDir();
    write(root, "AGENTS.md", "The agent runs terminal commands. Do not ask the user to run them.\n");
    write(
      home,
      ".cursor/plugins/local/acme/rules/commands.mdc",
      "---\nalwaysApply: true\n---\nI (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const report = compile({ ...options(root), home, includeUserRules: true });
    assert.equal(report.unresolved.length, 0);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0]?.effective?.layer, "project");
  });

  it("scopes a compile to one ecosystem", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Shared agents file.");
    write(root, ".github/copilot-instructions.md", "Copilot only file.");
    write(root, ".cursor/rules/always.mdc", "---\nalwaysApply: true\n---\nCursor only rule.\n");

    const copilot = compile({ ...options(root), ecosystem: "copilot" });
    assert.ok(copilot.inForce.some((item) => item.path === ".github/copilot-instructions.md"));
    assert.ok(copilot.inForce.some((item) => item.path === "AGENTS.md"));
    assert.ok(copilot.leftOut.some((item) => item.path === ".cursor/rules/always.mdc"));
  });

  it("leaves Codex-only files out of a cursor compile", () => {
    const home = tempDir("precedent-home-");
    const root = tempDir();
    write(root, "AGENTS.md", "Shared agents file.");
    write(root, "AGENTS.override.md", "Codex override.");
    write(home, ".codex/AGENTS.md", "User Codex file.");

    const cursor = compile({ ...options(root), home, includeUserRules: true, ecosystem: "cursor" });
    assert.ok(cursor.inForce.some((item) => item.path === "AGENTS.md"));
    assert.ok(cursor.leftOut.some((item) => item.path === "AGENTS.override.md"));
    assert.ok(cursor.leftOut.some((item) => item.path.includes(".codex")));
  });

  it("keeps CLAUDE.md in a cursor compile and leaves Claude rules out", () => {
    const root = tempDir();
    write(root, "CLAUDE.md", "Cursor covering document.");
    write(root, ".claude/rules/always.md", "Claude-only always-on rule.");

    const cursor = compile({ ...options(root), ecosystem: "cursor" });
    assert.ok(cursor.inForce.some((item) => item.path === "CLAUDE.md"));
    assert.ok(cursor.leftOut.some((item) => item.path === ".claude/rules/always.md"));
  });

  it("leaves .claude/CLAUDE.md and home ~/.claude/CLAUDE.md out of a cursor compile", () => {
    const home = tempDir("precedent-home-");
    const root = tempDir();
    write(root, "CLAUDE.md", "Cursor covering document.");
    write(root, ".claude/CLAUDE.md", "Always write tests. Practice TDD on every change.");
    write(home, ".claude/CLAUDE.md", "User Claude file.");

    const cursor = compile({ ...options(root), home, includeUserRules: true, ecosystem: "cursor" });
    assert.ok(cursor.inForce.some((item) => item.path === "CLAUDE.md"));
    assert.equal(cursor.inForce.some((item) => item.path.endsWith(".claude/CLAUDE.md") || item.path.endsWith(".claude\\CLAUDE.md")), false);
    assert.ok(cursor.leftOut.some((item) => item.path === ".claude/CLAUDE.md"));
    assert.ok(cursor.leftOut.some((item) => item.path.includes(".claude") && item.path.endsWith("CLAUDE.md") && item.path !== ".claude/CLAUDE.md"));
  });

  it("keeps nested AGENTS.md out when compiling a path outside appliesUnder", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root agents file.");
    write(root, "apps/meded/AGENTS.md", "Meded agents file.");

    const report = compile(options(root, "apps/other"));
    assert.ok(report.leftOut.some((item) => item.path === "apps/meded/AGENTS.md"));
    assert.ok(report.inForce.some((item) => item.path === "AGENTS.md"));
  });
});
