import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../scripts/lib/args.mjs";

test("parseArgs preserves a prompt beginning with a dash after --", () => {
  const parsed = parseArgs(["ask", "--", "-starting prompt; do not split"]);
  assert.equal(parsed.command, "ask");
  assert.equal(parsed.prompt, "-starting prompt; do not split");
});

test("parseArgs separates runtime flags from prompt text", () => {
  const parsed = parseArgs(["ask", "--print-timeout", "90s", "--model", "gemini-3.8-flash-low", "review this", "file"]);
  assert.equal(parsed.values["print-timeout"], "90s");
  assert.equal(parsed.values.model, "gemini-3.8-flash-low");
  assert.equal(parsed.prompt, "review this file");
});
