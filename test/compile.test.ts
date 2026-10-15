import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compile, newFindings } from "../src/compile.ts";
import { renderMarkdown, renderPrComment } from "../src/report.ts";
import { options, tempDir, write } from "./helpers.ts";

describe("compile + report", () => {
  it("returns a valid empty report for a repo with no instruction files", () => {
    const root = tempDir();
    write(root, "README.md", "nothing here\n");

    const report = compile(options(root));

    assert.equal(report.product, "precedent");
    assert.equal(report.version, 1);
    assert.equal(report.sources.length, 0);
    assert.equal(report.conflicts.length, 0);
    assert.equal(report.unresolved.length, 0);
    assert.match(renderMarkdown(report), /No always-on instruction conflicts/);
    assert.match(renderMarkdown(report), /^# Precedent/m);
  });

  it("redacts secrets in reports", () => {
    const root = tempDir();
    write(root, "AGENTS.md", "Never commit api_key=sk-super-secret-value-123456 in examples.\n");

    const report = compile(options(root));
    const text = report.sources[0]?.body ?? "";
    assert.equal(text.includes("sk-super-secret-value-123456"), false);
    assert.match(text, /\[REDACTED\]/);
  });

  it("diffs new unresolved findings against a baseline compile", () => {
    const base = tempDir("precedent-base-");
    write(base, "AGENTS.md", "The agent runs terminal commands.\n");
    const current = tempDir("precedent-pr-");
    write(current, "AGENTS.md", "The agent runs terminal commands.\n");
    write(
      current,
      ".cursor/rules/user.mdc",
      "---\nalwaysApply: true\n---\n\nI (the user) WILL RUN ALL TERMINAL COMMANDS YOU WILL NOT.\n",
    );

    const added = newFindings(compile(options(current)), compile(options(base)));
    assert.equal(added.unresolved.length, 1);
    const rendered = renderPrComment(compile(options(current)), added, {
      repository: "acme/widget",
      baseRef: "main",
      provenance: {
        event: "pull_request",
        baseRef: "main",
        baseSha: "abc1234",
        headSha: "def5678",
        compareUrl: "https://github.com/acme/widget/compare/abc...def",
      },
    });
    assert.match(rendered, /^# Precedent/m);
    assert.match(rendered, /acme\/widget/);
    assert.match(rendered, /## Findings/);
    assert.match(rendered, /who runs terminal commands/);
  });
});
