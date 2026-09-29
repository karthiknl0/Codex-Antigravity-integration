# Antigravity for Codex

Cross-platform Codex integration for Google's local Antigravity CLI (`agy`). Ask Antigravity for a second opinion, review a Git diff, or delegate a longer task without leaving Codex.

## Requirements

- Codex with plugin support
- Node.js 18.18 or newer
- Antigravity CLI installed and authenticated
- Git for diff review

The plugin does not install software or authenticate your Google account. Run `agy` interactively once to finish sign-in.

## Install locally

From a local checkout, run one command from the repository root:

```text
node scripts/install.mjs
```

That registers the local marketplace and installs `agy-codex` for the current Codex user.

If you prefer the explicit commands:

```text
codex plugin marketplace add C:\path\to\antigravity-codex-plugin
codex plugin add agy-codex@local-antigravity
```

### Install Antigravity CLI

The Codex plugin requires the standalone `agy` CLI; having only the Antigravity IDE is not enough.
On Windows, install it with the same command used for this setup:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Restart PowerShell after installation, then run `agy` once if authentication is requested. Verify with:

```text
agy --version
```

For a Git checkout:

```text
codex plugin marketplace add https://github.com/YOUR_ACCOUNT/antigravity-codex-plugin
codex plugin add agy-codex@local-antigravity
```

Restart Codex or start a new task after installing the plugin.

## Use it naturally

```text
Check my Antigravity setup.
Ask Antigravity for a second opinion on this implementation.
Review the current diff with Antigravity.
Delegate this investigation to Antigravity in the background.
```

The bundled runtime also supports `setup`, `ask`, `review`, `quota` (also `usage`), `start`, `status`, `result`, and `cancel`. `quota` forwards Antigravity's live `/usage` query and prints the current model-specific limits without starting a work task. For headless prompts that need Antigravity to execute tools, pass `--dangerously-skip-permissions` explicitly; otherwise Antigravity may stop at an interactive permission prompt.

To check live quota:

```text
node plugins/agy-codex/scripts/antigravity.mjs quota
```

### Choose a model

The plugin uses Antigravity's configured default unless you provide a model ID. List models with `agy models`, then pass one explicitly:

```text
node scripts/antigravity.mjs ask --model gemini-3.8-flash-low -- "Compare these two approaches."
```

The `--model` option is passed through only when requested, so older CLI versions retain the previous default behavior but may reject explicit model selection if they do not expose the flag.

## If Antigravity works in the IDE but Codex cannot find it

Set the executable explicitly for the Codex process:

```powershell
$env:AGY_BIN = 'C:\path\to\agy.exe'
```

On macOS/Linux:

```bash
export AGY_BIN=/path/to/agy
```

The resolver also checks `PATH`, `%LOCALAPPDATA%\agy\bin\agy.exe`, `~/.local/bin/agy`, `/opt/antigravity/bin/agy`, and `/usr/local/bin/agy`.

## Safety and limitations

Prompts are passed as process arguments with `shell:false`; they are never interpolated into a shell command. Review mode asks Antigravity not to modify files. Delegated work may modify the workspace and is clearly reported as such. The plugin does not assume a per-call model flag because current `agy` versions select the model from Antigravity configuration.

Antigravity can return exit code 0 with empty output when quota or backend failures occur. The runtime treats that as an error and reports available diagnostic signals.

## Development

```text
npm test
npm run validate
node scripts/smoke.mjs
```

Tests use fake `agy` executables and do not require a Google account.

## References

- Original Claude Code wrapper: `simplybychris/antigravity-plugin-cc`
- Cross-platform runtime reference: `Idun-Group/antigravity-plugin-cc`
- Codex plugin packaging: https://developers.openai.com/plugins/build/plugins

MIT License.
