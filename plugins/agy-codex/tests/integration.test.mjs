import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const runner = path.resolve("plugins/agy-codex/scripts/antigravity.mjs");

function fakeAgy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-int-"));
  const fake = path.join(root, "agy.mjs");
  fs.writeFileSync(fake, "if (process.argv.includes('--version')) console.log('agy 1.0.3'); else console.log('integration response')");
  return { root, fake };
}

function run(fake, args, cwd) {
  return execFileSync(process.execPath, [runner, ...args], { cwd, encoding: "utf8", env: { ...process.env, AGY_BIN: fake } });
}

test("setup and ask work through the installed runtime", () => {
  const { root, fake } = fakeAgy();
  const setup = JSON.parse(run(fake, ["setup"], root));
  assert.equal(setup.installed, true);
  assert.match(run(fake, ["ask", "--", "hello"], root), /integration response/);
});

test("empty output is a failing integration result", () => {
  const { root } = fakeAgy();
  const fake = path.join(root, "empty.mjs");
  fs.writeFileSync(fake, "process.exit(0)");
  assert.throws(() => run(fake, ["ask", "--", "hello"], root), /returned no output/);
});
