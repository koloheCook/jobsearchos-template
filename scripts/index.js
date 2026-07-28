// `node --test scripts/` (the AGENTS.md verification command) resolves this directory
// as a CommonJS module instead of searching it for test files, so this entrypoint is
// what makes that command run anything at all. It loads every *.test.cjs sibling, so
// a new test file is picked up without editing this file. CommonJS throughout keeps
// the Node floor low, per the PRD's long-stable-builtins constraint.
const { readdirSync } = require("node:fs");

for (const entry of readdirSync(__dirname).sort()) {
  if (entry.endsWith(".test.cjs")) require(`./${entry}`);
}
