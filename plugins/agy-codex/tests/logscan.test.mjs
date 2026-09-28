import test from "node:test";
import assert from "node:assert/strict";
import { scanAgyLog } from "../scripts/lib/logscan.mjs";

test("scanAgyLog extracts conversation id and quota reset", () => {
  const result = scanAgyLog("conversation=123e4567-e89b-12d3-a456-426614174000 RESOURCE_EXHAUSTED (429) Resets in 152h");
  assert.equal(result.conversationId, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(result.quota, "RESOURCE_EXHAUSTED (429) Resets in 152h");
});

test("scanAgyLog classifies auth and backend failures", () => {
  const result = scanAgyLog("authentication required\nbackend unavailable: 503");
  assert.equal(result.auth, true);
  assert.equal(result.backend, true);
  assert.equal(result.messages.length, 2);
});

test("scanAgyLog ignores unrelated text", () => {
  assert.deepEqual(scanAgyLog("normal progress line"), {
    conversationId: null, quota: null, auth: false, backend: false, messages: [],
  });
});
