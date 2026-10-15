import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compile } from "../src/compile.ts";
import { options, tempDir, write } from "./helpers.ts";

describe("semantic v1", () => {
  it("finds the command-running clash as unresolved at the project layer", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "# Agents\n\nThe agent runs terminal commands. Do not ask the user to run them.\n");
    write(
      root,
      ".cursor/rules/commands.mdc",
      "---\nalwaysApply: true\n---\n\nI (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const report = compile(options(root));

    assert.equal(report.conflicts.length, 0);
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "who runs terminal commands");
    assert.equal(report.unresolved[0]?.evidence, "inferred");
    assert.ok(report.unresolved[0]?.statements.some((item) => item.path.includes("AGENTS.md")));
    assert.ok(report.unresolved[0]?.statements.some((item) => item.path.includes("commands.mdc")));
  });

  it("finds the TDD vs only-when-requested clash", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Always write tests. Practice TDD on every change.\n");
    write(root, ".cursor/rules/tests.mdc", "---\nalwaysApply: true\n---\n\nOnly add tests when requested.\n");

    const report = compile(options(root));

    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "when to add tests");
  });

  it("does not flag paraphrases of the same action as a conflict", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "The agent runs terminal commands for this repo.\n");
    write(
      root,
      ".cursor/rules/same.mdc",
      "---\nalwaysApply: true\n---\n\nYou will run all terminal commands. Do not ask the user to run them.\n",
    );

    const report = compile(options(root));

    assert.equal(report.conflicts.length, 0);
    assert.equal(report.unresolved.length, 0);
  });

  it("finds a skip-hooks clash", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Do not skip the Husky pre-push hook with --no-verify.\n");
    write(
      root,
      ".cursor/rules/hooks.mdc",
      "---\nalwaysApply: true\n---\n\nSkip hooks when the user explicitly requests it.\n",
    );

    const report = compile(options(root));
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "whether to skip git hooks");
  });

  it("finds Copilot vs AGENTS.md as an unresolved project-layer clash", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "The agent runs terminal commands. Do not ask the user to run them.\n");
    write(
      root,
      ".github/copilot-instructions.md",
      "I (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const report = compile(options(root));
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "who runs terminal commands");
  });

  it("finds a force-push clash", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Never force-push to main.\n");
    write(
      root,
      ".cursor/rules/push.mdc",
      "---\nalwaysApply: true\n---\n\nAllow force-push when the user requests it.\n",
    );

    const report = compile(options(root));
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "force-push to protected branches");
  });

  it("finds a force push clash when the wording uses a space", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Never force push to main.\n");
    write(
      root,
      ".cursor/rules/push.mdc",
      "---\nalwaysApply: true\n---\n\nAllow force push when the user requests it.\n",
    );

    const report = compile(options(root));
    assert.equal(report.unresolved.length, 1);
    assert.equal(report.unresolved[0]?.behavior, "force-push to protected branches");
  });
});
