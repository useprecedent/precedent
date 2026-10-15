import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.ts";
import { options } from "./helpers.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("shipped fixtures", () => {
  it("finds both DoD clashes on the conflicting-always-on fixture", () => {
    const report = compile(options(join(fixtures, "conflicting-always-on")));
    const behaviors = report.unresolved.map((item) => item.behavior).sort();
    assert.deepEqual(behaviors, ["when to add tests", "who runs terminal commands"]);
  });

  it("finds Cursor vs Copilot vs Claude Code clashes on the multi-agent fixture", () => {
    const report = compile(options(join(fixtures, "multi-agent")));
    const behaviors = report.unresolved.map((item) => item.behavior).sort();
    assert.deepEqual(behaviors, ["when to add tests", "who runs terminal commands"]);
  });

  it("leaves .claude/CLAUDE.md out of a cursor compile of the multi-agent fixture", () => {
    const report = compile({ ...options(join(fixtures, "multi-agent")), ecosystem: "cursor" });
    assert.equal(report.inForce.some((item) => item.path === ".claude/CLAUDE.md"), false);
    assert.ok(report.leftOut.some((item) => item.path === ".claude/CLAUDE.md"));
    assert.deepEqual(report.unresolved.map((item) => item.behavior), []);
  });
});
