import test from "node:test";
import assert from "node:assert/strict";
import { formatFailure } from "../scripts/lib/logscan.mjs";

test("formatFailure explains empty output with quota signal", () => {
  const message = formatFailure({
    result: { stdout: "", stderr: "", code: 0, timedOut: false },
    logText: "RESOURCE_EXHAUSTED (429) Resets in 2h",
    bin: "/tmp/agy",
  });
  assert.match(message, /quota/i);
  assert.match(message, /2h/);
});

test("formatFailure preserves stderr for non-zero exits", () => {
  const message = formatFailure({
    result: { stdout: "", stderr: "permission denied", code: 7, timedOut: false },
    logText: "",
    bin: "agy",
  });
  assert.match(message, /permission denied/);
  assert.match(message, /exit code 7/);
});
