import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const children = new Map();

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function statePath(stateDir, id) { return path.join(stateDir, `${id}.json`); }
function writeState(stateDir, state) {
  ensureDir(stateDir);
  const tmp = `${statePath(stateDir, state.id)}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, statePath(stateDir, state.id));
}
function readState(stateDir, id) {
  return JSON.parse(fs.readFileSync(statePath(stateDir, id), "utf8"));
}
function processAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
// Image name of a live pid, or null if it cannot be determined.
function processImage(pid) {
  if (process.platform === "win32") {
    const r = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });
    const m = r.stdout?.match(/^"([^"]+)","(\d+)"/m);
    return m && Number(m[2]) === pid ? m[1] : null;
  }
  const r = spawnSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? path.basename(r.stdout.trim()) : null;
}
function sameImage(actual, expected) {
  if (!actual) return false;
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  return a === e || (a.length >= 15 && e.startsWith(a)); // ps truncates comm to 15 chars
}
// Kill the job's whole tree so any helper processes agy started go with it.
function killTree(pid) {
  if (process.platform === "win32") {
    return spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }).status === 0;
  }
  try { process.kill(-pid, "SIGTERM"); return true; } catch { /* not a group leader */ }
  try { process.kill(pid, "SIGTERM"); return true; } catch { return false; }
}
function refreshJob(stateDir, state) {
  if (state.status !== "running" || processAlive(state.pid)) return state;
  const stdout = state.stdoutFile && fs.existsSync(state.stdoutFile) ? fs.readFileSync(state.stdoutFile, "utf8") : state.stdout;
  const stderr = state.stderrFile && fs.existsSync(state.stderrFile) ? fs.readFileSync(state.stderrFile, "utf8") : state.stderr;
  const finalState = { ...state, status: "done", stdout, stderr, result: stdout || stderr };
  writeState(stateDir, finalState);
  return finalState;
}

export function createJob({ stateDir, cwd, prompt, options = {} }) {
  const id = `agy-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const state = { id, stateDir, cwd, prompt, options, status: "pending", createdAt: new Date().toISOString(), pid: null, stdout: "", stderr: "", result: null };
  writeState(stateDir, state);
  return { id, statePath: statePath(stateDir, id), ...state };
}

export function readJob({ stateDir, id }) { return refreshJob(stateDir, readState(stateDir, id)); }

export function listJobs({ stateDir, cwd }) {
  if (!fs.existsSync(stateDir)) return [];
  return fs.readdirSync(stateDir).filter((name) => name.endsWith(".json")).map((name) => readState(stateDir, name.slice(0, -5))).filter((job) => !cwd || job.cwd === cwd).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function startJob({ stateDir, id, command, args = [], wait = true, env = process.env }) {
  const initial = readState(stateDir, id);
  if (initial.status !== "pending") return Promise.resolve(initial);
  const outputDir = path.join(stateDir, "output");
  ensureDir(outputDir);
  if (!wait) {
    const stdoutFile = path.join(outputDir, `${id}.out`);
    const stderrFile = path.join(outputDir, `${id}.err`);
    const stdoutFd = fs.openSync(stdoutFile, "a");
    const stderrFd = fs.openSync(stderrFile, "a");
    const child = spawn(command, args, { cwd: initial.cwd, env, shell: false, windowsHide: true, detached: true, stdio: ["ignore", stdoutFd, stderrFd] });
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
    children.set(id, child);
    const running = { ...initial, status: "running", pid: child.pid, image: path.basename(command), stdoutFile, stderrFile };
    writeState(stateDir, running);
    child.unref();
    return Promise.resolve(running);
  }
  const child = spawn(command, args, { cwd: initial.cwd, env, shell: false, windowsHide: true, detached: !wait });
  children.set(id, child);
  const state = { ...initial, status: "running", pid: child.pid, image: path.basename(command) };
  writeState(stateDir, state);
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => { stdout += chunk; });
  child.stderr?.on("data", (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.once("error", (error) => { children.delete(id); writeState(stateDir, { ...readState(stateDir, id), status: "failed", stderr: `${stderr}${error.message}`, stdout }); reject(error); });
    child.once("close", (code, signal) => {
      children.delete(id);
      const current = readState(stateDir, id);
      const cancelled = current.status === "cancelled";
      const finalState = { ...current, status: cancelled ? "cancelled" : (code === 0 ? "done" : "failed"), exitCode: code, signal, stdout, stderr, result: stdout || stderr };
      writeState(stateDir, finalState);
      resolve(finalState);
    });
  });
  return done;
}

// Jobs recorded before `image` existed always ran the agy binary.
function imageMatches(pid, expected) {
  if (expected) return sameImage(processImage(pid), expected);
  return /^agy/i.test(processImage(pid) || "");
}

// cancel usually runs in a different CLI process from start, so the in-memory
// children map is empty here — kill by the pid recorded in the job state.
// Known limit: the pid could be recycled between the image check and the kill;
// a separate process cannot hold a handle to close that window.
export function cancelJob({ stateDir, id }) {
  const current = readState(stateDir, id);
  if (current.status !== "running") return current;
  const cancelledAt = new Date().toISOString();
  if (!processAlive(current.pid)) {
    writeState(stateDir, { ...current, status: "cancelled", cancelledAt, cancelNote: "process already exited" });
  } else if (!imageMatches(current.pid, current.image)) {
    // pid was reused by an unrelated process; never kill it.
    writeState(stateDir, { ...current, status: "cancelled", cancelledAt, cancelNote: `pid ${current.pid} not killed: live process is not ${current.image || "agy"}` });
  } else if (killTree(current.pid)) {
    writeState(stateDir, { ...current, status: "cancelled", cancelledAt, cancelNote: `killed pid ${current.pid} and its children` });
  } else if (!processAlive(current.pid)) {
    // taskkill fails if the process exited on its own just before the kill.
    writeState(stateDir, { ...current, status: "cancelled", cancelledAt, cancelNote: "process exited before it could be killed" });
  } else {
    // Leave it running so status never claims a cancel that did not happen.
    writeState(stateDir, { ...current, cancelNote: `kill of pid ${current.pid} failed; process still running` });
  }
  return readState(stateDir, id);
}
