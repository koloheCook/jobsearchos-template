const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const script = path.join(__dirname, "write-preflight.mjs");

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function run(root, args) {
  return spawnSync(process.execPath, [script, ...args, "--root", root], { encoding: "utf8" });
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function repo() {
  const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-preflight-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "jobSearchOS tests"]);
  write(root, "AGENTS.md", "instructions\n");
  write(root, "landing/_ledger.md", "ledger\n");
  write(root, "scripts/stub.mjs", "export {};\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "fixture"]);
  return root;
}

test("write preflight ignores dirt outside the planned write paths", () => {
  const root = repo();
  write(root, "landing/_ledger.md", "ledger\nnew row\n");
  write(root, "prompts/other-session.md", "draft\n");

  const result = run(root, ["scripts/", "AGENTS.md"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { status: "clear", blocking: [], unrelatedDirty: 2 });
});

test("write preflight blocks when a planned path or directory is dirty", () => {
  const root = repo();
  write(root, "scripts/stub.mjs", "export const changed = true;\n");
  write(root, "scripts/new.mjs", "export {};\n");

  const result = run(root, ["scripts"]);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.blocking.map((entry) => entry.path).sort(), ["scripts/new.mjs", "scripts/stub.mjs"]);
});

test("write preflight requires at least one path", () => {
  const result = run(repo(), []);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /at least one path/);
});
