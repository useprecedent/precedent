#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distCli = join(packageRoot, "dist", "cli.js");
const srcCli = join(packageRoot, "src", "cli.ts");
const args = process.argv.slice(2);

function isInstalledPackage(root) {
  return root.replaceAll("\\", "/").includes("/node_modules/");
}

function runStripTypesCli() {
  const child = spawn(process.execPath, ["--experimental-strip-types", srcCli, ...args], {
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

// Use compiled dist only when installed via npm; prefer source in local git clones to avoid stale build artifacts
if (existsSync(distCli) && isInstalledPackage(packageRoot)) {
  try {
    await import(pathToFileURL(distCli).href);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
} else {
  runStripTypesCli();
}
