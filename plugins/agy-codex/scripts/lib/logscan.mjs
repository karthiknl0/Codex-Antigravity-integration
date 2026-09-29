const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

// agy writes glog-style lines. Routine INFO/WARNING lines ("I0929 19:22:33 500 http_helpers.go:307 ...",
// "quota_manager.go ... doRefreshQuota", thread ids like 500) must not be read as failure signals:
// a bare `\b5\d\d\b` matched thread ids and the word "quota"/"backend" appeared in routine info lines,
// so a still-running or merely slow job could be reported as a backend/auth failure. Only error-severity
// glog lines (E/F) and non-glog lines are classified; 5xx needs an explicit HTTP/status/code context.
const glogInfoOrWarn = /^[IW]\d{4}\s/;
const authSignal = /auth(?:entication|orization)\s+(?:required|failed|error)|not signed in|login required|unauthenticated/i;
const backendSignal = /backend|service unavailable|(?:http|status|code)\D{0,3}5\d\d\b|\b5\d\d\s+(?:internal|bad gateway|service|gateway)|internal error/i;

function classifiableLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !glogInfoOrWarn.test(line));
}

export function scanAgyLog(text = "") {
  const conversationId = text.match(uuidPattern)?.[0] ?? null;
  const lines = classifiableLines(text);
  const joined = lines.join("\n");
  const quotaMatch = joined.match(/RESOURCE_EXHAUSTED[^\r\n]*/i);
  const auth = authSignal.test(joined);
  const backend = backendSignal.test(joined);
  const messages = lines.filter((line) => {
    return /RESOURCE_EXHAUSTED/i.test(line) || authSignal.test(line) || backendSignal.test(line);
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
