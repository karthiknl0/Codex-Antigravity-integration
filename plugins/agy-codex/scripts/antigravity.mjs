#!/usr/bin/env node
import process from "node:process";
import { resolveAgyBin } from "./lib/paths.mjs";
import { parseArgs } from "./lib/args.mjs";
import { buildAgyArgs, runAgy } from "./lib/agy.mjs";

const parsed = parseArgs(process.argv.slice(2));
if (parsed.command !== "ask") {
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
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.timedOut) {
      console.error("error: agy timed out");
      process.exitCode = 124;
    } else if (result.code !== 0) {
      process.exitCode = result.code ?? 1;
    } else if (!result.stdout.trim()) {
      console.error("error: agy returned no output");
      process.exitCode = 1;
    }
  }
}
