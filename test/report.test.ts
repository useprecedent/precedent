import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.ts";
import { compareUrlForRef, renderMarkdown, renderPrComment } from "../src/report.ts";
import { options, tempDir, write } from "./helpers.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("report contract", () => {
  it("builds compare URLs with short SHAs", () => {
    const url = compareUrlForRef(
      "demonslayer/hashira",
      "a1b2c3d4e5f6789012345678901234567890abcd",
      "e4f5a6b7c8d9012345678901234567890abcd",
    );
    assert.equal(url, "https://github.com/demonslayer/hashira/compare/a1b2c3d...e4f5a6b");
  });

  it("uses directory basename as local subject", () => {
    const root = tempDir("my-repo-");
    write(root, "README.md", "ok\n");
    const report = compile(options(root));
    const md = renderMarkdown(report);
    assert.match(md, /^# Precedent\n\nmy-repo-/m);
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
        provenance: {
          event: "pull_request",
          baseRef: "main",
          baseSha: "1111111",
          headSha: "2222222",
          compareUrl: "https://github.com/org/repo/compare/1111111...2222222",
        },
      },
    );
    assert.match(md, /<!-- precedent-report -->/);
    assert.match(md, /No always-on conflicts in git on this head; none new relative to main/);
    assert.match(md, /^Scope: always-on · team rules/m);
    assert.doesNotMatch(md, /git sources/);
    assert.match(md, /\[compare\]\(/);
    assert.doesNotMatch(md, /Compile path/);
    assert.doesNotMatch(md, /## Findings/);
    assert.doesNotMatch(md, /## Provenance/);
  });

  it("lists ecosystems from in-force sources on a scoped compile", () => {
    const root = tempDir();
    write(root, ".cursor/rules/always.mdc", "---\nalwaysApply: true\n---\nCursor only rule.\n");
    write(root, ".github/copilot-instructions.md", "Copilot only file.\n");
    const md = renderMarkdown(compile({ ...options(root), ecosystem: "cursor" }));
    assert.match(md, /^- Ecosystems: cursor$/m);
    assert.doesNotMatch(md, /copilot/);
  });

  it("matches the shipped empty PR comment gold file", () => {
    const root = tempDir();
    write(root, "README.md", "ok\n");
    const report = compile(options(root));
    const md = renderPrComment(
      report,
      { conflicts: [], unresolved: [] },
      {
        repository: "demonslayer/hashira",
        baseRef: "main",
        provenance: {
          event: "pull_request",
          baseRef: "main",
          baseSha: "a1b2c3d",
          headSha: "e4f5a6b",
          compareUrl: "https://github.com/demonslayer/hashira/compare/a1b2c3d...e4f5a6b",
        },
      },
    );
    const gold = readFileSync(join(fixtures, "golden-pr-comment-empty.md"), "utf8");
    assert.equal(md.trimEnd(), gold.trimEnd());
  });
});
