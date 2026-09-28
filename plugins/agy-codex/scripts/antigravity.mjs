#!/usr/bin/env node
import process from "node:process";
import { resolveAgyBin } from "./lib/paths.mjs";
import { parseArgs } from "./lib/args.mjs";
import { buildAgyArgs, runAgy } from "./lib/agy.mjs";
import { formatFailure } from "./lib/logscan.mjs";

const parsed = parseArgs(process.argv.slice(2));
if (parsed.command === "setup") {
  const found = resolveAgyBin();
  if (!found) {
    console.log(JSON.stringify({ installed: false, path: null, version: null, authHint: "unknown", warnings: ["agy not found"] }, null, 2));
  } else {
    const result = await runAgy({ bin: found.path, args: ["--version"], cwd: process.cwd(), timeoutMs: 5000 });
    console.log(JSON.stringify({ installed: result.code === 0, path: found.path, source: found.source, version: result.stdout.trim() || result.stderr.trim() || null, authHint: "run agy interactively once if authentication is required", warnings: [] }, null, 2));
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
      args: buildAgyArgs({ prompt: parsed.prompt, printTimeout: parsed.values["print-timeout"] || "10m", logFile: parsed.values["log-file"] }),
      cwd: process.cwd(),
    });
    if (result.code === 0 && result.stdout.trim()) process.stdout.write(result.stdout);
    else { console.error(formatFailure({ result, bin: found.path })); process.exitCode = result.timedOut ? 124 : (result.code || 1); }
  }
}
