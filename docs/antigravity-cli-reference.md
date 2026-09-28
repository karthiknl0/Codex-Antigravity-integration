# Antigravity CLI reference

The runtime targets the local `agy` executable in headless print mode:

```text
agy -p "prompt" --print-timeout 10m --log-file <path>
```

The plugin does not pass a model flag. Select the model in Antigravity's own configuration. Authentication remains local to Antigravity; the plugin only reports whether the executable is available and tells the user to run `agy` interactively when sign-in is required.

The runtime treats empty stdout as failure even when the process exits with code 0. It scans available diagnostic text for quota exhaustion, authentication failures, backend errors, and conversation ids.
