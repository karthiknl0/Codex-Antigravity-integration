import { execFileSync } from "node:child_process";

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function collectDiff({ cwd, base, staged = false } = {}) {
  try {
    if (base) return { diff: git(cwd, ["diff", base]), source: `base:${base}` };
    const working = git(cwd, ["diff", "HEAD"]);
    if (working) return { diff: working, source: "working-tree" };
    if (staged) return { diff: git(cwd, ["diff", "--cached"]), source: "staged" };
    return { diff: git(cwd, ["diff", "--cached"]), source: "staged" };
  } catch (error) {
    throw new Error(`unable to collect Git diff: ${error.stderr?.toString().trim() || error.message}`);
  }
}
