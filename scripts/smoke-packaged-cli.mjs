import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const tarball = execSync("npm pack --silent", { cwd: root, encoding: "utf8" }).trim();
const tarballPath = join(root, tarball);
const installDir = mkdtempSync(join(tmpdir(), "precedent-smoke-"));

try {
  execSync("npm init -y", { cwd: installDir, stdio: "ignore" });
  execSync(`npm install "${tarballPath}"`, { cwd: installDir, stdio: "inherit" });
  execSync("node node_modules/@useprecedent/precedent/bin/precedent.js --help", {
    cwd: installDir,
    stdio: "inherit",
  });
} finally {
  rmSync(installDir, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
