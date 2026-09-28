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

export function createJob({ stateDir, cwd, prompt, options = {} }) {
  const id = `agy-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const state = { id, stateDir, cwd, prompt, options, status: "pending", createdAt: new Date().toISOString(), pid: null, stdout: "", stderr: "", result: null };
  writeState(stateDir, state);
  return { id, statePath: statePath(stateDir, id), ...state };
}

export function readJob({ stateDir, id }) { return readState(stateDir, id); }

export function listJobs({ stateDir, cwd }) {
  if (!fs.existsSync(stateDir)) return [];
  return fs.readdirSync(stateDir).filter((name) => name.endsWith(".json")).map((name) => readState(stateDir, name.slice(0, -5))).filter((job) => !cwd || job.cwd === cwd).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function startJob({ stateDir, id, command, args = [], wait = true, env = process.env }) {
  const initial = readState(stateDir, id);
  if (initial.status !== "pending") return Promise.resolve(initial);
  const outputDir = path.join(stateDir, "output");
  ensureDir(outputDir);
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
  if (!wait) { child.unref(); return Promise.resolve(readState(stateDir, id)); }
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
