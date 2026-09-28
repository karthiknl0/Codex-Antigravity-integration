import { resolveAgyBin } from "../plugins/agy-codex/scripts/lib/paths.mjs";
import { runAgy } from "../plugins/agy-codex/scripts/lib/agy.mjs";

const found = resolveAgyBin();
if (!found) {
  console.log("agy unavailable: set AGY_BIN or expose the Antigravity CLI on PATH");
  process.exitCode = 1;
} else {
  const result = await runAgy({ bin: found.path, args: ["--version"], cwd: process.cwd(), timeoutMs: 5000 });
  if (result.code !== 0) {
    console.error(result.stderr || `agy exited with ${result.code}`);
    process.exitCode = result.code || 1;
  } else {
    console.log(JSON.stringify({ path: found.path, source: found.source, version: result.stdout.trim() }, null, 2));
  }
}
