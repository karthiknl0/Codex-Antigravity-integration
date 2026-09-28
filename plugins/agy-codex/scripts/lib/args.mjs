const valuedOptions = new Set(["print-timeout", "log-file", "conversation", "base", "model"]);

export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const flags = {};
  const values = {};
  const promptParts = [];
  let passthrough = false;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!passthrough && token === "--") {
      passthrough = true;
      continue;
    }
    if (!passthrough && token.startsWith("--")) {
      const name = token.slice(2);
      if (valuedOptions.has(name)) {
        values[name] = rest[++index] ?? "";
      } else {
        flags[name] = true;
      }
      continue;
    }
    promptParts.push(token);
  }
  return { command, flags, values, prompt: promptParts.join(" ").trim() };
}
