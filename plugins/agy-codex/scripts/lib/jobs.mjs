import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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
    const running = { ...initial, status: "running", pid: child.pid, stdoutFile, stderrFile };
    writeState(stateDir, running);
    child.unref();
    return Promise.resolve(running);
  }
  const child = spawn(command, args, { cwd: initial.cwd, env, shell: false, windowsHide: true, detached: !wait });
  children.set(id, child);
  const state = { ...initial, status: "running", pid: child.pid };
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

export function cancelJob({ stateDir, id }) {
  const current = readState(stateDir, id);
  if (current.status === "running") {
    children.get(id)?.kill("SIGTERM");
    writeState(stateDir, { ...current, status: "cancelled", cancelledAt: new Date().toISOString() });
  }
  return readState(stateDir, id);
}
