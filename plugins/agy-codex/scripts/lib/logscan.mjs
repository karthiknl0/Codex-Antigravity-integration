const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export function scanAgyLog(text = "") {
  const conversationId = text.match(uuidPattern)?.[0] ?? null;
  const quotaMatch = text.match(/RESOURCE_EXHAUSTED[^\r\n]*/i);
  const auth = /auth(?:entication|orization)|not signed in|login required|unauthenticated/i.test(text);
  const backend = /backend|service unavailable|\b5\d\d\b|internal error/i.test(text);
  const messages = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    return /RESOURCE_EXHAUSTED|auth(?:entication|orization)|not signed in|login required|unauthenticated|backend|service unavailable|\b5\d\d\b|internal error/i.test(line);
  });
  return { conversationId, quota: quotaMatch?.[0] ?? null, auth, backend, messages };
}

export function formatFailure({ result, logText = "", bin = "agy" }) {
  const signals = scanAgyLog(logText);
  if (result.timedOut) return `agy timed out while running ${bin}`;
  if (signals.quota) return `Antigravity quota appears exhausted: ${signals.quota}`;
  if (signals.auth) return "Antigravity authentication is required; run agy interactively once and sign in.";
  if (signals.backend) return `Antigravity backend error: ${signals.messages.join(" | ")}`;
  if (result.code !== 0) return `agy failed with exit code ${result.code}: ${result.stderr || "no stderr"}`;
  if (!result.stdout?.trim()) return "agy returned no output; inspect Antigravity authentication, quota, and logs.";
  return result.stdout;
}
