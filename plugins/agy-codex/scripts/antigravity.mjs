#!/usr/bin/env node
import process from "node:process";
import { resolveAgyBin } from "./lib/paths.mjs";
import { parseArgs } from "./lib/args.mjs";
import { buildAgyArgs, runAgy } from "./lib/agy.mjs";
import { formatFailure } from "./lib/logscan.mjs";
import { defaultStateDir } from "./lib/paths.mjs";
import { createJob, startJob, readJob, listJobs, cancelJob } from "./lib/jobs.mjs";
import { collectDiff } from "./lib/git.mjs";

const parsed = parseArgs(process.argv.slice(2));
if (parsed.command === "setup") {
  const found = resolveAgyBin();
  if (!found) {
    console.log(JSON.stringify({ installed: false, path: null, version: null, authHint: "unknown", warnings: ["agy not found"] }, null, 2));
  } else {
    const result = await runAgy({ bin: found.path, args: ["--version"], cwd: process.cwd(), timeoutMs: 5000 });
    console.log(JSON.stringify({ installed: result.code === 0, path: found.path, source: found.source, version: result.stdout.trim() || result.stderr.trim() || null, authHint: "run agy interactively once if authentication is required", warnings: [] }, null, 2));
  }
} else if (parsed.command === "review") {
  const found = resolveAgyBin();
  const diff = collectDiff({ cwd: process.cwd(), base: parsed.values.base }).diff;
  if (!diff) { console.error("error: no Git diff found; make or stage changes first"); process.exitCode = 1; }
  else if (!found) { console.error("error: agy was not found; set AGY_BIN or install Antigravity CLI"); process.exitCode = 127; }
  else {
    const focus = parsed.prompt || "Review this diff for correctness, security, regressions, and missing tests.";
    const result = await runAgy({ bin: found.path, args: buildAgyArgs({ prompt: `${focus}\n\nReview only; do not modify files.\n\nGit diff:\n${diff}`, model: parsed.values.model }), cwd: process.cwd() });
    if (result.code === 0 && result.stdout.trim()) process.stdout.write(result.stdout);
    else { console.error(formatFailure({ result, bin: found.path })); process.exitCode = result.timedOut ? 124 : (result.code || 1); }
  }
} else if (["start", "status", "result", "cancel"].includes(parsed.command)) {
  const stateDir = defaultStateDir();
  if (parsed.command === "start") {
    if (!parsed.prompt) { console.error("error: start requires a prompt"); process.exitCode = 64; }
    else {
      const found = resolveAgyBin();
      if (!found) { console.error("error: agy was not found; set AGY_BIN or install Antigravity CLI"); process.exitCode = 127; }
      else {
        const job = createJob({ stateDir, cwd: process.cwd(), prompt: parsed.prompt });
        await startJob({ ...job, command: found.path, args: buildAgyArgs({ prompt: parsed.prompt, printTimeout: parsed.values["print-timeout"] || "10m", logFile: pathForJob(stateDir, job.id), model: parsed.values.model, dangerouslySkipPermissions: parsed.flags["dangerously-skip-permissions"] }), wait: false });
        console.log(job.id);
      }
    }
  } else {
    const id = parsed.prompt || listJobs({ stateDir, cwd: process.cwd() })[0]?.id;
    if (!id) { console.error(`error: no ${parsed.command} job found`); process.exitCode = 1; }
    else if (parsed.command === "status") console.log(JSON.stringify(readJob({ stateDir, id }), null, 2));
    else if (parsed.command === "cancel") console.log(JSON.stringify(cancelJob({ stateDir, id }), null, 2));
    else { const job = readJob({ stateDir, id }); process.stdout.write(job.result || job.stdout || job.stderr || ""); }
  }
} else if (parsed.command !== "ask") {
  console.error(`unsupported command: ${parsed.command}`);
  process.exitCode = 64;
} else if (!parsed.prompt) {
  console.error("error: ask requires a prompt");
  process.exitCode = 64;
} else {
  const found = resolveAgyBin();
  if (!found) {
    console.error("error: agy was not found; set AGY_BIN or install Antigravity CLI");
    process.exitCode = 127;
  } else {
    const result = await runAgy({
      bin: found.path,
      args: buildAgyArgs({ prompt: parsed.prompt, printTimeout: parsed.values["print-timeout"] || "10m", logFile: parsed.values["log-file"], model: parsed.values.model, dangerouslySkipPermissions: parsed.flags["dangerously-skip-permissions"] }),
      cwd: process.cwd(),
    });
    if (result.code === 0 && result.stdout.trim()) process.stdout.write(result.stdout);
    else { console.error(formatFailure({ result, bin: found.path })); process.exitCode = result.timedOut ? 124 : (result.code || 1); }
  }
}

function pathForJob(stateDir, id) {
  return `${stateDir}/${id}.log`;
}
