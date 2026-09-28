import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAgyArgs, runAgy } from "../scripts/lib/agy.mjs";

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agy-runtime-"));
}

test("buildAgyArgs keeps prompt as one argument and includes print diagnostics", () => {
  const prompt = "quotes \"; newlines\nUnicode ✓; leading -dash";
  assert.deepEqual(buildAgyArgs({ prompt, printTimeout: "90s", logFile: "run.log" }), [
    "-p", prompt, "--print-timeout", "90s", "--log-file", "run.log",
  ]);
  assert.deepEqual(buildAgyArgs({ prompt, dangerouslySkipPermissions: true }), [
    "-p", prompt, "--print-timeout", "10m", "--dangerously-skip-permissions",
  ]);
});

test("runAgy preserves arbitrary prompt text for a fake executable", async () => {
  const root = fixture();
  const fake = path.join(root, "fake-agy.mjs");
  fs.writeFileSync(fake, "#!/usr/bin/env node\nconsole.log(process.argv.slice(2).join('\\n'))\n");
  fs.chmodSync(fake, 0o755);
  const prompt = "quotes \"; newlines\nUnicode ✓; leading -dash";
  const result = await runAgy({ bin: fake, args: ["-p", prompt], cwd: root, timeoutMs: 1000 });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /quotes/);
  assert.match(result.stdout, /Unicode/);
  assert.equal(result.timedOut, false);
});

test("runAgy reports non-zero exits and timeouts", async () => {
  const root = fixture();
  const failing = path.join(root, "fail.mjs");
  const slow = path.join(root, "slow.mjs");
  fs.writeFileSync(failing, "#!/usr/bin/env node\nconsole.error('failed'); process.exit(7)\n");
  fs.writeFileSync(slow, "#!/usr/bin/env node\nsetTimeout(() => {}, 5000)\n");
  fs.chmodSync(failing, 0o755);
  fs.chmodSync(slow, 0o755);
  const failure = await runAgy({ bin: failing, args: [], cwd: root, timeoutMs: 1000 });
  assert.equal(failure.code, 7);
  assert.match(failure.stderr, /failed/);
  const timeout = await runAgy({ bin: slow, args: [], cwd: root, timeoutMs: 30 });
  assert.equal(timeout.timedOut, true);
});
