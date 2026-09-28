# Cross-Platform Codex–Antigravity Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Codex plugin that safely asks and delegates work to a locally installed Antigravity CLI across Windows, macOS, and Linux.

**Architecture:** Package a Codex skill and marketplace entry around a portable Node.js companion. The companion resolves `agy`, spawns it with `shell: false`, captures stdout/stderr/exit state, enriches empty-output failures from logs, and stores optional background jobs outside the repository. Codex-facing instructions remain thin and direct users to the companion for operational behavior.

**Tech Stack:** Node.js 18.18+ ESM, built-in `child_process`, `fs`, `path`, `crypto`, and `readline` modules; Codex `.codex-plugin` manifest; Node's built-in test runner; fake `agy` fixtures.

**Spec:** `docs/superpowers/specs/2026-09-28-cross-platform-codex-antigravity-design.md`

## Global Constraints

- Support Windows, macOS, and Linux.
- Use `AGY_BIN` plus platform-specific fallback locations when resolving the executable.
- Never pass prompts through a shell or interpolate them into command text.
- Never enable dangerous permission-bypass flags implicitly.
- Do not assume a per-call `--model` or `-m` flag exists.
- Keep background state outside the repository.
- Do not authenticate the user or modify Git state.
- Review mode must be read-only in its prompt and execution options.
- Image generation, model mutation, and Antigravity-IDE session control are out of scope for the first release.

## Review Focus

- A prompt beginning with `-`, containing newlines, quotes, Unicode, or shell metacharacters must arrive unchanged; Task 2 pins this with argv/stdin fixture tests.
- Windows executable resolution must find `.exe` and common LocalAppData installs without assuming a Unix home directory; Task 1 pins explicit and fallback resolution tests.
- `agy` exiting 0 with empty stdout must become an actionable error when logs indicate quota, auth, or backend failure; Task 3 pins log-scan tests.
- A timed-out or cancelled child must not leave an orphaned background process or corrupt job state; Task 4 pins lifecycle tests.
- Review prompts must not accidentally grant write behavior or include staged/unstaged diff ambiguity; Task 5 pins Git-context tests.

---

### Task 1: Scaffold the Codex plugin and cross-platform runtime foundation

**Files:**
- Create: `.agents/plugins/marketplace.json`
- Create: `plugins/agy-codex/.codex-plugin/plugin.json`
- Create: `plugins/agy-codex/package.json`
- Create: `plugins/agy-codex/scripts/lib/paths.mjs`
- Create: `plugins/agy-codex/tests/paths.test.mjs`
- Create: root `package.json`

**Interfaces:**
- Produces `resolveAgyBin({ env, platform, homeDir, pathEnv }) -> { path, source } | null`.
- Produces `defaultStateDir({ env, platform, homeDir }) -> string`.
- The runtime package is ESM and exposes `npm test` through Node's built-in test runner.

- [ ] **Step 1: Write failing path-resolution tests** covering `AGY_BIN`, PATH lookup, Windows `.exe`, `%LOCALAPPDATA%\agy\bin\agy.exe`, macOS/Linux `~/.local/bin/agy`, and missing binaries.
- [ ] **Step 2: Run `node --test plugins/agy-codex/tests/paths.test.mjs` and verify the resolver is missing.**
- [ ] **Step 3: Implement `paths.mjs` using `path.delimiter`, `process.platform`-style injected values, `fs.accessSync`, and no shell calls.**
- [ ] **Step 4: Add manifests and marketplace metadata pointing Codex at `./skills/` and the runtime package.**
- [ ] **Step 5: Run the path tests and manifest JSON validation; expect PASS.**
- [ ] **Step 6: Commit with `feat: scaffold cross-platform Codex Antigravity plugin`.**

### Task 2: Implement safe foreground `agy` execution

**Files:**
- Create: `plugins/agy-codex/scripts/lib/args.mjs`
- Create: `plugins/agy-codex/scripts/lib/agy.mjs`
- Create: `plugins/agy-codex/scripts/antigravity.mjs`
- Create: `plugins/agy-codex/tests/args.test.mjs`
- Create: `plugins/agy-codex/tests/agy.test.mjs`

**Interfaces:**
- `parseArgs(argv) -> { command, flags, values, prompt }`.
- `buildAgyArgs({ prompt, printTimeout, logFile, continueConversation }) -> string[]`.
- `runAgy({ bin, args, prompt, cwd, env, timeoutMs, signal }) -> Promise<{ stdout, stderr, code, timedOut, durationMs }>`.
- CLI command `node scripts/antigravity.mjs ask -- <prompt>` prints normalized result or exits non-zero with an actionable error.

- [ ] **Step 1: Write failing tests for argument parsing and command construction.** Assert prompt text is not split and no prompt content is placed into a shell string.
- [ ] **Step 2: Run the focused tests and verify failure.**
- [ ] **Step 3: Implement `args.mjs` and `buildAgyArgs`; pass prompt through stdin and use `--print`/`-p` only as an explicit CLI contract choice.**
- [ ] **Step 4: Implement `runAgy` with `spawn(bin, args, { shell: false })`, bounded timers, SIGTERM/SIGKILL escalation, and captured streams.**
- [ ] **Step 5: Add a fake executable fixture that echoes stdin and records argv; test quotes, Unicode, newlines, leading dashes, non-zero exit, and timeout.**
- [ ] **Step 6: Run focused tests and commit `feat: add safe foreground agy runner`.**

### Task 3: Add setup diagnostics and Antigravity failure/log handling

**Files:**
- Create: `plugins/agy-codex/scripts/lib/logscan.mjs`
- Modify: `plugins/agy-codex/scripts/antigravity.mjs`
- Create: `plugins/agy-codex/tests/logscan.test.mjs`
- Create: `plugins/agy-codex/tests/diagnostics.test.mjs`

**Interfaces:**
- `scanAgyLog(text) -> { conversationId, quota, auth, backend, messages }`.
- `formatFailure({ result, logText, bin }) -> string`.
- CLI command `setup --json` returns `{ installed, path, version, authHint, warnings }`.

- [ ] **Step 1: Write failing log-scan tests for conversation UUIDs, `RESOURCE_EXHAUSTED`, auth failures, backend errors, and unrelated logs.**
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement deterministic regex-based scanning with no dependency on transcript file layout.**
- [ ] **Step 4: Implement `setup --json` using the resolver and `agy --version`, without attempting login or installation.**
- [ ] **Step 5: Convert empty stdout plus diagnostic signals into distinct errors; preserve useful stderr and exit codes.**
- [ ] **Step 6: Run diagnostics tests and commit `feat: surface Antigravity setup and runtime failures`.**

### Task 4: Add safe background job lifecycle

**Files:**
- Create: `plugins/agy-codex/scripts/lib/jobs.mjs`
- Modify: `plugins/agy-codex/scripts/antigravity.mjs`
- Create: `plugins/agy-codex/tests/jobs.test.mjs`

**Interfaces:**
- `createJob({ stateDir, prompt, cwd, options }) -> { id, statePath }`.
- `startJob(job) -> Promise<void>`.
- `readJob({ stateDir, id }) -> JobState`.
- `listJobs({ stateDir, cwd }) -> JobState[]`.
- `cancelJob({ stateDir, id }) -> JobState`.
- CLI commands: `start`, `status`, `result`, and `cancel`.

- [ ] **Step 1: Write failing tests for atomic pending/running/done/failed/cancelled transitions, latest-job selection, and state isolation by workspace.**
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement external state paths using a stable workspace hash and atomic temp-file rename.**
- [ ] **Step 4: Implement detached child handling with platform-safe process-group behavior and persisted PID metadata.**
- [ ] **Step 5: Implement status/result/cancel behavior, including stale PID cleanup and partial output on timeout.**
- [ ] **Step 6: Run lifecycle tests and commit `feat: add background Antigravity jobs`.**

### Task 5: Add Codex skills and Git-diff review workflow

**Files:**
- Create: `plugins/agy-codex/skills/antigravity-cli/SKILL.md`
- Create: `plugins/agy-codex/skills/antigravity-result-handling/SKILL.md`
- Create: `plugins/agy-codex/skills/antigravity-cli/agents/openai.yaml`
- Create: `plugins/agy-codex/scripts/lib/git.mjs`
- Create: `plugins/agy-codex/tests/git.test.mjs`

**Interfaces:**
- `collectDiff({ cwd, base, staged }) -> { diff, source }`.
- Skill instructions map natural-language requests to `setup`, `ask`, `start`, `status`, `result`, `cancel`, and `review` runtime commands.
- `agents/openai.yaml` defines the implicit Codex invocation contract for the skill.

- [ ] **Step 1: Write failing Git-context tests for unstaged diff, staged diff, `base...HEAD`, clean tree, and command failure.**
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement `git.mjs` with argument arrays, repository-local cwd, and explicit read-only review prompts.**
- [ ] **Step 4: Write the two skills with setup, ask, delegation, review, background lifecycle, safety, and result-handling instructions.**
- [ ] **Step 5: Add a local skill/manifests validator and run it plus Git tests.**
- [ ] **Step 6: Commit `feat: expose Antigravity workflows to Codex`.**

### Task 6: Documentation, release validation, and local smoke test

**Files:**
- Create: `README.md` replacement or rewrite for the Codex plugin
- Create: `docs/antigravity-cli-reference.md`
- Create: `scripts/validate.mjs`
- Create: `scripts/smoke.mjs`
- Create: `plugins/agy-codex/tests/integration.test.mjs`

**Interfaces:**
- `node scripts/validate.mjs` exits 0 only when manifests, skill frontmatter, paths, and executable references are valid.
- `node scripts/smoke.mjs` performs a non-mutating setup check and reports whether the local `agy` is available.

- [ ] **Step 1: Write integration tests using the fake CLI for setup, ask, review, start/status/result, quota failure, and cancellation.**
- [ ] **Step 2: Run the integration suite and verify failures for missing runtime pieces.**
- [ ] **Step 3: Implement validators for JSON manifests, required skill files, supported path references, and package metadata.**
- [ ] **Step 4: Implement the smoke command with `AGY_BIN` override support and no automatic install/authentication.**
- [ ] **Step 5: Document installation, marketplace registration, `AGY_BIN`, supported platforms, permissions, known Antigravity CLI limitations, and test commands.**
- [ ] **Step 6: Run the complete test suite, validator, and smoke test; commit `docs: document and validate Codex Antigravity plugin`.**

### Final verification

- [ ] Run `npm test` from the repository root.
- [ ] Run `node scripts/validate.mjs`.
- [ ] Run `node scripts/smoke.mjs` with the discovered local executable if available.
- [ ] Inspect `git diff --check` and `git status --short`.
- [ ] Run a fresh Codex plugin install/marketplace validation if the local Codex CLI exposes the plugin commands.
- [ ] Perform a final review focused on prompt injection through argv/stdin, path resolution, child-process cleanup, and accidental workspace mutation.
