import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createJob, startJob, readJob, listJobs, cancelJob } from "../scripts/lib/jobs.mjs";

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agy-jobs-"));
}

test("background jobs transition to done and isolate by workspace", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const script = path.join(root, "job.mjs");
  fs.mkdirSync(path.join(root, "repo-a"), { recursive: true });
  fs.writeFileSync(script, "console.log('done output')");
  const job = createJob({ stateDir, cwd: path.join(root, "repo-a"), prompt: "finish" });
  assert.equal(readJob({ stateDir, id: job.id }).status, "pending");
  await startJob({ ...job, command: process.execPath, args: [script] });
  assert.equal(readJob({ stateDir, id: job.id }).status, "done");
  assert.equal(listJobs({ stateDir, cwd: path.join(root, "repo-a") }).length, 1);
  assert.equal(listJobs({ stateDir, cwd: path.join(root, "repo-b") }).length, 0);
});

test("cancelJob marks a running job cancelled", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const script = path.join(root, "slow.mjs");
  fs.writeFileSync(script, "setTimeout(() => {}, 5000)");
  const job = createJob({ stateDir, cwd: root, prompt: "wait" });
  const running = startJob({ ...job, command: process.execPath, args: [script], wait: false });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const cancelled = cancelJob({ stateDir, id: job.id });
  assert.equal(cancelled.status, "cancelled");
  await running;
  assert.equal(readJob({ stateDir, id: job.id }).status, "cancelled");
});
