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

  it("keeps nested AGENTS.md out when compiling a path outside appliesUnder", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Root agents file.");
    write(root, "apps/meded/AGENTS.md", "Meded agents file.");

    const report = compile(options(root, "apps/other"));
    assert.ok(report.leftOut.some((item) => item.path === "apps/meded/AGENTS.md"));
    assert.ok(report.inForce.some((item) => item.path === "AGENTS.md"));
  });
});
