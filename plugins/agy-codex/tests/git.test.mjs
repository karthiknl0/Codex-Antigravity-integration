import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { collectDiff } from "../scripts/lib/git.mjs";

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-git-"));
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test"]);
  return root;
}

test("collectDiff returns working-tree changes without modifying Git state", () => {
  const root = repo();
  fs.writeFileSync(path.join(root, "file.txt"), "before\n");
  execFileSync("git", ["-C", root, "add", "file.txt"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "initial"]);
  fs.writeFileSync(path.join(root, "file.txt"), "after\n");
  const result = collectDiff({ cwd: root });
  assert.match(result.diff, /after/);
  assert.equal(result.source, "working-tree");
});

test("collectDiff reports a clean tree and supports a base ref", () => {
  const root = repo();
  fs.writeFileSync(path.join(root, "file.txt"), "base\n");
  execFileSync("git", ["-C", root, "add", "file.txt"]);
  execFileSync("git", ["-C", root, "commit", "-qm", "initial"]);
  assert.equal(collectDiff({ cwd: root }).diff, "");
  fs.writeFileSync(path.join(root, "file.txt"), "branch\n");
  assert.match(collectDiff({ cwd: root, base: "HEAD" }).diff, /branch/);
});
