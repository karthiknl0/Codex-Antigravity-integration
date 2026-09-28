import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAgyBin, defaultStateDir } from "../scripts/lib/paths.mjs";

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agy-paths-"));
}

test("AGY_BIN wins over PATH and fallback locations", () => {
  const root = fixture();
  const explicit = path.join(root, "custom", "agy.exe");
  fs.mkdirSync(path.dirname(explicit), { recursive: true });
  fs.writeFileSync(explicit, "fixture");
  assert.deepEqual(resolveAgyBin({
    env: { AGY_BIN: explicit },
    platform: "win32",
    homeDir: root,
    pathEnv: "",
  }), { path: explicit, source: "AGY_BIN" });
});

test("PATH lookup supports Windows executable extensions", () => {
  const root = fixture();
  const binDir = path.join(root, "bin");
  const executable = path.join(binDir, "agy.exe");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(executable, "fixture");
  assert.deepEqual(resolveAgyBin({
    env: {},
    platform: "win32",
    homeDir: root,
    pathEnv: binDir,
  }), { path: executable, source: "PATH" });
});

test("platform fallback locations find local Antigravity installs", () => {
  const root = fixture();
  const localAppData = path.join(root, "LocalAppData");
  const executable = path.join(localAppData, "agy", "bin", "agy.exe");
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, "fixture");
  assert.deepEqual(resolveAgyBin({
    env: { LOCALAPPDATA: localAppData },
    platform: "win32",
    homeDir: root,
    pathEnv: "",
  }), { path: executable, source: "LOCALAPPDATA" });
});

test("Unix fallback resolves ~/.local/bin/agy", () => {
  const root = fixture();
  const executable = path.join(root, ".local", "bin", "agy");
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, "fixture");
  assert.deepEqual(resolveAgyBin({
    env: {},
    platform: "linux",
    homeDir: root,
    pathEnv: "",
  }), { path: executable, source: "HOME" });
});

test("missing executable returns null and state directory stays outside repo", () => {
  const root = fixture();
  assert.equal(resolveAgyBin({ env: {}, platform: "linux", homeDir: root, pathEnv: "" }), null);
  assert.equal(defaultStateDir({ env: {}, platform: "linux", homeDir: root }), path.join(root, ".codex", "antigravity"));
});
