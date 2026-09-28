import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

test("cancelJob from a separate process kills the detached job", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const script = path.join(root, "slow.mjs");
  fs.writeFileSync(script, "setTimeout(() => {}, 30000)");
  const job = createJob({ stateDir, cwd: root, prompt: "wait" });
  const running = await startJob({ ...job, command: process.execPath, args: [script], wait: false });
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  assert.equal(alive(running.pid), true);
  const jobsUrl = new URL("../scripts/lib/jobs.mjs", import.meta.url).href;
  const code = `const { cancelJob } = await import(${JSON.stringify(jobsUrl)}); console.log(JSON.stringify(cancelJob({ stateDir: ${JSON.stringify(stateDir)}, id: ${JSON.stringify(job.id)} })));`;
  const out = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).status, "cancelled");
  let dead = false;
  for (let attempt = 0; attempt < 40 && !dead; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    dead = !alive(running.pid);
  }
  assert.equal(dead, true, `pid ${running.pid} still alive after cancel`);
  assert.equal(readJob({ stateDir, id: job.id }).status, "cancelled");
});

test("cancelJob does not kill a live pid whose image does not match the job", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const job = createJob({ stateDir, cwd: root, prompt: "reused pid" });
  const state = JSON.parse(fs.readFileSync(job.statePath, "utf8"));
  fs.writeFileSync(job.statePath, JSON.stringify({ ...state, status: "running", pid: process.pid, image: "definitely-not-this-process.exe" }));
  const result = cancelJob({ stateDir, id: job.id });
  assert.equal(result.status, "cancelled");
  assert.match(result.cancelNote, /not killed/);
});

test("cancelJob on a legacy state without image only kills an agy process", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const job = createJob({ stateDir, cwd: root, prompt: "legacy" });
  const state = JSON.parse(fs.readFileSync(job.statePath, "utf8"));
  fs.writeFileSync(job.statePath, JSON.stringify({ ...state, status: "running", pid: process.pid }));
  const result = cancelJob({ stateDir, id: job.id });
  assert.equal(result.status, "cancelled");
  assert.match(result.cancelNote, /not killed: live process is not agy/);
});

test("detached jobs retain output after the launcher exits", async () => {
  const root = fixture();
  const stateDir = path.join(root, "state");
  const script = path.join(root, "quick.mjs");
  fs.writeFileSync(script, "console.log('detached output')");
  const job = createJob({ stateDir, cwd: root, prompt: "quick" });
  await startJob({ ...job, command: process.execPath, args: [script], wait: false });
  let result;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    result = readJob({ stateDir, id: job.id });
    if (result.status === "done") break;
  }
  assert.equal(result.status, "done");
  assert.match(result.result, /detached output/);
});
