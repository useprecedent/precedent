import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CompileOptions } from "../src/types.ts";

export function tempDir(prefix = "precedent-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function write(root: string, relPath: string, contents: string): string {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
  return abs;
}

export function link(root: string, relPath: string, target: string): string {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  symlinkSync(target, abs);
  return abs;
}

export function options(root: string, path = "."): CompileOptions {
  return {
    root,
    path,
    home: root,
    includeUserRules: false,
    includeAncestors: false,
    extraRules: [],
  };
}
