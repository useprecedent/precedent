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
});
