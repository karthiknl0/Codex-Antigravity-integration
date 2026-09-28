import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  ".agents/plugins/marketplace.json",
  "plugins/agy-codex/.codex-plugin/plugin.json",
  "plugins/agy-codex/skills/antigravity-cli/SKILL.md",
  "plugins/agy-codex/skills/antigravity-cli/agents/openai.yaml",
  "plugins/agy-codex/skills/antigravity-result-handling/SKILL.md",
  "plugins/agy-codex/scripts/antigravity.mjs",
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`missing required plugin file: ${relative}`);
}
for (const relative of [".agents/plugins/marketplace.json", "plugins/agy-codex/.codex-plugin/plugin.json"]) {
  JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}
for (const relative of ["plugins/agy-codex/skills/antigravity-cli/SKILL.md", "plugins/agy-codex/skills/antigravity-result-handling/SKILL.md"]) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!text.startsWith("---\n") || !text.includes("\nname:") || !text.includes("\ndescription:")) throw new Error(`invalid skill frontmatter: ${relative}`);
}
console.log(`valid: ${required.length} plugin files and manifests`);
