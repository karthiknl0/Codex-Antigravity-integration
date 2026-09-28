---
name: antigravity-result-handling
description: Interpret and report results from the Antigravity Codex companion, including quota, authentication, timeout, empty-output, and background-job states.
---

# Result handling

Return Antigravity’s useful response without inventing missing content. Preserve conversation ids and job ids when present.

- Missing executable: ask the user to set `AGY_BIN` or install Antigravity CLI.
- Authentication error: ask the user to run `agy` interactively once and complete Google sign-in.
- Quota error: report the reset message and explain that retrying immediately will not help.
- Empty stdout with exit code 0: treat it as a failure, not a successful empty answer.
- Timeout: report that the process was stopped and include any captured partial output.
- Background job: show the id, status, and the exact next command (`status`, `result`, or `cancel`).
