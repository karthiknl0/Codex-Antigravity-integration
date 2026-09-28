import { spawn } from "node:child_process";
import path from "node:path";

export function buildAgyArgs({ prompt, printTimeout = "10m", logFile, conversation, model, dangerouslySkipPermissions = false } = {}) {
  if (!prompt) throw new Error("prompt is required");
  const args = ["-p", prompt, "--print-timeout", printTimeout];
  if (model) args.push("--model", model);
  if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
  if (logFile) args.push("--log-file", logFile);
  if (conversation) args.push("--conversation", conversation);
  return args;
}

export function runAgy({ bin, args = [], cwd, env = process.env, timeoutMs = 11 * 60 * 1000, signal } = {}) {
  if (!bin) return Promise.reject(new Error("agy executable path is required"));
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const isNodeScript = path.extname(bin).toLowerCase() === ".mjs";
    const command = isNodeScript ? process.execPath : bin;
    const commandArgs = isNodeScript ? [bin, ...args] : args;
    const child = spawn(command, commandArgs, { cwd, env, shell: false, windowsHide: true, signal });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 250).unref();
    }, timeoutMs);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, closeSignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, signal: closeSignal, timedOut, durationMs: Date.now() - started });
    });
  });
}
