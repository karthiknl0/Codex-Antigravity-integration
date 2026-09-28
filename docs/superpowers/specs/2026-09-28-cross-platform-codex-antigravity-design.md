# Cross-Platform Codex–Antigravity Plugin Design

## Goal

Create a Codex plugin that lets Codex ask or delegate work to the locally installed Google Antigravity CLI (`agy`) without requiring the user to leave Codex. The plugin must work on Windows, macOS, and Linux and must support installations where `agy` is available to the Antigravity IDE but is not automatically visible on Codex's process `PATH`.

## Scope

The first release will provide:

- readiness checks for the local `agy` executable and authentication state;
- natural-language Codex skill instructions for asking Antigravity, delegating a bounded task, and reviewing the current Git diff;
- a portable Node.js runner that launches `agy` without shell interpolation;
- configurable executable discovery through `AGY_BIN` plus platform-specific fallback locations;
- bounded foreground execution with timeout, exit-code, stderr, and empty-output diagnostics;
- optional detached background jobs stored outside the repository;
- conversation-id and Antigravity log/error extraction when the CLI exposes them;
- fake-CLI tests that run in CI without a real Antigravity account.

Image generation, model mutation, and Antigravity-IDE session control are out of the first release. `agy` does not expose a stable per-call model flag, so model selection remains controlled by the user's Antigravity configuration.

## Non-goals

The plugin will not provide hosted Antigravity access, authenticate the user, modify Git state, bypass Codex sandbox policy, or read undocumented IDE internals as its primary transport. It will invoke the local CLI as a separate non-interactive session.

## Architecture

```text
Codex skill
  -> Node runner
      -> resolve AGY_BIN / platform paths
      -> spawn agy with argv and prompt on stdin or supported print args
      -> capture stdout, stderr, exit code, timeout, and optional log
      -> normalize a useful result for Codex
  -> result-handling guidance
```

The plugin will use the Codex compatibility layout initially:

```text
.agents/plugins/marketplace.json
plugins/agy-codex/
  .codex-plugin/plugin.json
  skills/antigravity-cli/SKILL.md
  skills/antigravity-result-handling/SKILL.md
  scripts/antigravity.mjs
  scripts/lib/{agy,paths,args,jobs,git,logscan}.mjs
  tests/
```

The runtime will use `child_process.spawn` with `shell: false`, pass the prompt through stdin where supported, and keep user text out of a shell command string. The wrapper will be shared across all operating systems; only executable discovery and detached-process details may vary by platform.

## CLI contract

The runner will target the stable headless `agy -p/--print` contract. It will not assume a `--model` flag. The default process watchdog will be configurable, with a longer Antigravity print timeout and a separate hard-kill timeout.

Because Antigravity may return exit code 0 with no stdout for quota or backend failures, an empty response is an error state. The runner will inspect captured stderr and, when a log path is available, scan the log for quota, authentication, backend, and conversation-id signals. Log parsing is diagnostic enrichment, not a dependency on undocumented transcript storage.

## Safety and failure handling

- Never pass prompts through a shell or interpolate them into command text.
- Never enable dangerous permission-bypass flags implicitly.
- Review mode is read-only in its prompt and execution options.
- Delegation clearly reports that Antigravity may edit the workspace.
- Missing `agy`, missing authentication, timeout, non-zero exit, empty output, and quota exhaustion receive distinct actionable errors.
- Background jobs use an external state directory keyed by workspace and job id, with atomic state writes and cancellation support.
- The runner never overwrites an existing image or repository file as part of the first release.

## Verification

The implementation is complete when:

1. plugin structure and manifests validate;
2. fake-CLI tests pass on Windows, macOS, and Linux CI;
3. prompt arguments containing quotes, newlines, Unicode, and leading dashes are preserved;
4. executable discovery honors `AGY_BIN` and common platform locations;
5. failures are surfaced when stdout is empty despite exit code 0;
6. foreground and background lifecycle tests pass;
7. a local smoke test can call the user's installed `agy` without modifying the repository.

## Reference decisions

The existing `simplybychris/antigravity-plugin-cc` supplies the thin forwarding workflow and model-configuration caveat. The Idun-Group implementation supplies the stronger Node runtime, background-job shape, log scanning, and conversation-id handling. Public Codex plugins confirm the required `.codex-plugin` and marketplace packaging conventions.
