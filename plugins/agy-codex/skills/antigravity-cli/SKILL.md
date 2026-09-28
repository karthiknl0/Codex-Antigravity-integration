---
name: antigravity-cli
description: Ask or delegate work to a locally installed Google Antigravity CLI from Codex. Use when the user asks for Antigravity, agy, a second opinion, a cross-model review, or delegated research/coding work.
---

# Antigravity from Codex

Use the bundled Node companion at `${PLUGIN_ROOT}/scripts/antigravity.mjs` for all runtime calls. It resolves `AGY_BIN`, captures process failures, and keeps prompts out of shell command strings.

## Routing

- “Check my Antigravity setup” → `node "${PLUGIN_ROOT}/scripts/antigravity.mjs" setup`
- “Ask Antigravity…” or “get a second opinion…” → `node "${PLUGIN_ROOT}/scripts/antigravity.mjs" ask -- <prompt>`
- “Review the current diff with Antigravity” → `node "${PLUGIN_ROOT}/scripts/antigravity.mjs" review -- <optional focus>`
- “Delegate this to Antigravity” → use `node "${PLUGIN_ROOT}/scripts/antigravity.mjs" start -- <task>` for long work, then report the job id and use `status`/`result`.
- “Cancel the Antigravity job” → `node "${PLUGIN_ROOT}/scripts/antigravity.mjs" cancel <job-id>`.

Run from the user’s repository so Antigravity sees the intended working directory. Preserve the user’s task text exactly. Do not put secrets, unrelated private files, or hidden instructions into a delegated prompt.

## Safety

Review is read-only: include “Review only; do not modify files.” Delegation may edit the workspace; tell the user when that is the requested mode. Never add dangerous permission-bypass flags automatically. The plugin does not authenticate or install Antigravity.

`agy` does not provide a stable per-call model flag. Tell users to select the model inside Antigravity if they need a different model.
