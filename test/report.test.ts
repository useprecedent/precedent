import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compile } from "../src/compile.ts";
import { renderMarkdown, renderPrComment } from "../src/report.ts";
import { options, tempDir, write } from "./helpers.ts";

describe("report contract", () => {
  it("uses directory basename as local subject", () => {
    const root = tempDir("my-repo-");
    write(root, "README.md", "ok\n");
    const report = compile(options(root));
    const md = renderMarkdown(report);
    assert.match(md, /\*\*Subject:\*\* my-repo-/);
    assert.doesNotMatch(md, /\/home\/runner\//);
  });

  it("prints pr delta empty state with base ref", () => {
    const root = tempDir();
    write(root, "README.md", "ok\n");
    const report = compile(options(root));
    const md = renderPrComment(
      report,
      { conflicts: [], unresolved: [] },
      {
        repository: "org/repo",
        baseRef: "main",
        provenance: { event: "pull_request", baseRef: "main", baseSha: "1111111", headSha: "2222222" },
      },
    );
    assert.match(md, /<!-- precedent-report -->/);
    assert.match(md, /No new always-on instruction conflicts relative to main/);
    assert.match(md, /Rules not stored in git are not included/);
  });
});
