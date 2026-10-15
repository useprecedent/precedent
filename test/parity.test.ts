import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { collectInventory } from "../src/inventory.ts";
import { tempDir } from "./helpers.ts";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "compile_instructions.py");

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

describe("python / ts inventory parity", () => {
  it("matches the original compile_instructions.py JSON on the prototype fixture", () => {
    const home = tempDir("precedent-home-");
    const root = join(home, "projects", "app");
    write(join(home, "CLAUDE.md"), "Ancestor says the agent runs commands.\n");
    write(join(home, ".cursor", "rules", "commands.mdc"), "---\nalwaysApply: true\n---\n\nThe user runs every command.\n");
    write(join(root, "CLAUDE.md"), "Project says to run npm run verify.\n");
    write(join(root, "AGENTS.md"), "Project agents file.\n");
    write(join(root, "apps", "web", "AGENTS.md"), "Web agents file.\n");
    mkdirSync(join(root, "apps", "web"), { recursive: true });
    symlinkSync("AGENTS.md", join(root, "apps", "web", "CLAUDE.md"));
    write(join(root, "node_modules", "pkg", "CLAUDE.md"), "Ignore this package.\n");
    write(join(root, ".cursor", "rules", "notes.md"), "Plain markdown is not a rule.\n");
    write(
      join(root, ".cursor", "rules", "always.mdc"),
      "---\ndescription: Test first\nalwaysApply: true\n---\n\nWrite a failing test first.\n",
    );
    write(
      join(root, ".cursor", "rules", "glob.mdc"),
      "---\nglobs: src/**/*.ts, tests/**/*.ts\nalwaysApply: false\n---\n\nType the boundary.\n",
    );
    write(
      join(root, ".cursor", "rules", "intelligent.mdc"),
      "---\ndescription: Use when editing API handlers\nalwaysApply: false\n---\n\nValidate at the boundary.\n",
    );
    write(join(root, ".cursor", "rules", "manual.mdc"), "---\nalwaysApply: false\n---\n\nOnly when named.\n");

    const python = JSON.parse(
      execFileSync("python3", [script, "--root", root, "--home", home], { encoding: "utf8" }),
    ) as { sources: unknown[] };
    const ts = collectInventory({
      root,
      home,
      includeUserRules: true,
      includeAncestors: true,
      extraRules: [],
    });

    assert.deepEqual(ts.sources, python.sources);
    assert.deepEqual(ts.missingFromDisk, ["team rules", "user rules stored in Cursor settings"]);
  });
});
