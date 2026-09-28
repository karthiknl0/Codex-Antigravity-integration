import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAgyBin } from "../plugins/agy-codex/scripts/lib/paths.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codexCommand = process.env.CODEX_BIN || (process.platform === "win32" ? "codex.exe" : "codex");

function run(args) {
  const output = execFileSync(codexCommand, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(output);
}

try {
  run(["plugin", "marketplace", "add", repoRoot, "--json"]);
  run(["plugin", "add", "agy-codex@local-antigravity", "--json"]);
  console.log("agy-codex installed for this Codex user.");
  console.log("Restart Codex or start a new task to load the skill.");
  const agy = resolveAgyBin();
  if (agy) {
    const version = execFileSync(agy.path, ["--version"], { encoding: "utf8" }).trim();
    console.log(`Antigravity CLI detected: ${version}`);
  } else if (process.platform === "win32") {
    console.log("If agy is missing on Windows: irm https://antigravity.google/cli/install.ps1 | iex");
  } else {
    console.log("If agy is missing, install the Antigravity CLI using its official installer, then run `agy` once to authenticate.");
  }
} catch (error) {
  const details = error.stderr?.toString().trim() || error.message;
  console.error(`Plugin installation failed: ${details}`);
  process.exitCode = 1;
}
