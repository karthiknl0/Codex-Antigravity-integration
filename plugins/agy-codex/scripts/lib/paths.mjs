import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function pathCandidates({ platform, env, homeDir }) {
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    return [
      path.join(localAppData, "agy", "bin", "agy.exe"),
      path.join(localAppData, "Antigravity", "bin", "agy.exe"),
      path.join(homeDir, ".local", "bin", "agy.exe"),
    ];
  }
  return [
    path.join(homeDir, ".local", "bin", "agy"),
    "/opt/antigravity/bin/agy",
    "/usr/local/bin/agy",
  ];
}

export function resolveAgyBin({ env = process.env, platform = process.platform, homeDir = os.homedir(), pathEnv = env.PATH || "" } = {}) {
  const explicit = env.AGY_BIN;
  if (explicit && isFile(explicit)) return { path: explicit, source: "AGY_BIN" };

  const pathEntries = pathEnv.split(path.delimiter).filter(Boolean);
  const names = platform === "win32" ? ["agy.exe", "agy.cmd", "agy"] : ["agy"];
  for (const entry of pathEntries) {
    for (const name of names) {
      const candidate = path.join(entry, name);
      if (isFile(candidate)) return { path: candidate, source: "PATH" };
    }
  }

  for (const candidate of pathCandidates({ platform, env, homeDir })) {
    if (isFile(candidate)) return { path: candidate, source: platform === "win32" && candidate.includes(env.LOCALAPPDATA || "__missing__") ? "LOCALAPPDATA" : "HOME" };
  }
  return null;
}

export function defaultStateDir({ env = process.env, platform = process.platform, homeDir = os.homedir() } = {}) {
  if (env.CODEX_HOME) return path.join(env.CODEX_HOME, "antigravity");
  if (platform === "win32") return path.join(env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "codex", "antigravity");
  return path.join(homeDir, ".codex", "antigravity");
}
