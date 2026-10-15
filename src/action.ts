import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, newFindings } from "./compile.ts";
import { defaultHome } from "./inventory.ts";
import { renderPrComment } from "./report.ts";

const COMMENT_MARKER = "<!-- precedent-report -->";

type PullRequest = {
  number: number;
  base: { ref: string; sha: string };
};

function readEvent(): { pull_request?: PullRequest } {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return {};
  return JSON.parse(readFileSync(path, "utf8")) as { pull_request?: PullRequest };
}

async function github(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.GITHUB_TOKEN ?? process.env.INPUT_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${path} failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function checkoutBase(sha: string): string {
  const dir = mkdtempSync(join(tmpdir(), "precedent-base-"));
  execFileSync("git", ["worktree", "add", "--detach", dir, sha], { stdio: "inherit" });
  return dir;
}

async function upsertComment(prNumber: number, body: string): Promise<void> {
  const comments = (await github(`/issues/${prNumber}/comments?per_page=100`)) as {
    id: number;
    body: string;
  }[];
  const existing = comments.find((comment) => comment.body.includes(COMMENT_MARKER));
  if (existing) {
    await github(`/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    return;
  }
  await github(`/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function main(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const failOnUnresolved = (process.env.INPUT_FAIL_ON_UNRESOLVED ?? "false") === "true";
  const event = readEvent();
  const current = compile({
    root: workspace,
    path: ".",
    home: defaultHome(),
    includeUserRules: false,
    includeAncestors: false,
    extraRules: [],
  });

  let added = { conflicts: current.conflicts, unresolved: current.unresolved };
  if (event.pull_request) {
    const baseDir = checkoutBase(event.pull_request.base.sha);
    const baseline = compile({
      root: baseDir,
      path: ".",
      home: defaultHome(),
      includeUserRules: false,
      includeAncestors: false,
      extraRules: [],
    });
    added = newFindings(current, baseline);
  }

  const comment = renderPrComment(current, added);
  writeFileSync(join(workspace, "precedent-report.md"), comment);
  if (event.pull_request) await upsertComment(event.pull_request.number, comment);

  process.stdout.write(comment + "\n");
  if (failOnUnresolved && current.unresolved.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
