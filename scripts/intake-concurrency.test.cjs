const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const script = path.join(__dirname, "intake-concurrency.mjs");

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function run(root, args) {
  return spawnSync(process.execPath, [script, ...args, "--root", root], { encoding: "utf8" });
}

function parse(result) {
  return JSON.parse(result.stdout);
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function repo() {
  const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-concurrency-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "jobSearchOS tests"]);
  write(root, "AGENTS.md", "instructions\n");
  write(root, "PRD.md", "spec\n");
  write(root, "scripts/stub.mjs", "export {};\n");
  write(root, "landing/_ledger.md", "ledger\n");
  write(root, "landing/_runs.md", "runs\n");
  write(root, "out/mc/jobsearch-manifest.json", "{}\n");
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "fixture"]);
  return root;
}

test("intake concurrency permits expected output dirt and unrelated paths, then excludes a second owner", () => {
  const root = repo();
  write(root, "landing/_ledger.md", "ledger\nnew row\n");
  write(root, "out/mc/jobsearch-manifest.json", "{\"generatedAt\":\"later\"}\n");
  write(root, "notes/unrelated.md", "draft\n");

  const acquired = run(root, ["acquire", "--mode", "scheduled"]);
  assert.equal(acquired.status, 0, acquired.stderr);
  const receipt = parse(acquired);
  assert.equal(receipt.status, "ready");
  assert.deepEqual(receipt.allowedDirty.map((entry) => entry.path), [
    "landing/_ledger.md",
    "out/mc/jobsearch-manifest.json",
  ]);
  assert.deepEqual(receipt.nonOverlappingDirty.map((entry) => entry.path), ["notes/unrelated.md"]);
  assert.equal(receipt.receiptSafe, true);

  const excluded = run(root, ["acquire", "--mode", "manual"]);
  assert.equal(excluded.status, 73);
  assert.equal(parse(excluded).status, "lock-held");

  const wrongOwner = run(root, ["release", "--token", "not-the-owner"]);
  assert.equal(wrongOwner.status, 74);
  const released = run(root, ["release", "--token", receipt.token]);
  assert.equal(released.status, 0, released.stderr);
  assert.equal(parse(released).status, "released");
});

test("intake concurrency blocks a dirty protected path while retaining a receipt-safe lock", () => {
  const root = repo();
  write(root, "AGENTS.md", "instructions changed\n");

  const acquired = run(root, ["acquire", "--mode", "scheduled"]);
  assert.equal(acquired.status, 2);
  const receipt = parse(acquired);
  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.receiptSafe, true);
  assert.deepEqual(receipt.blocking.map((entry) => entry.path), ["AGENTS.md"]);
  assert.match(receipt.blocking[0].reason, /protected/);

  const released = run(root, ["release", "--token", receipt.token]);
  assert.equal(released.status, 0, released.stderr);
});

test("intake concurrency blocks staged overlap and marks the run log unsafe", () => {
  const root = repo();
  write(root, "landing/_runs.md", "runs\nstaged row\n");
  git(root, ["add", "landing/_runs.md"]);

  const acquired = run(root, ["acquire", "--mode", "scheduled"]);
  assert.equal(acquired.status, 2);
  const receipt = parse(acquired);
  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.receiptSafe, false);
  assert.deepEqual(receipt.blocking.map((entry) => entry.path), ["landing/_runs.md"]);
  assert.match(receipt.blocking[0].reason, /staged/);

  const released = run(root, ["release", "--token", receipt.token]);
  assert.equal(released.status, 0, released.stderr);
});

test("intake concurrency reports an unlocked repository", () => {
  const root = repo();
  const inspected = run(root, ["inspect"]);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.deepEqual(parse(inspected), { status: "unlocked" });
});

test("stale lock cleanup requires the inspected run id", () => {
  const root = repo();
  const acquired = run(root, ["acquire", "--mode", "manual"]);
  assert.equal(acquired.status, 0, acquired.stderr);
  const receipt = parse(acquired);

  const rejected = run(root, ["clear-stale", "--confirm-stale", "different-run"]);
  assert.equal(rejected.status, 75);
  const inspected = run(root, ["inspect"]);
  assert.equal(parse(inspected).owner.runId, receipt.runId);

  const cleared = run(root, ["clear-stale", "--confirm-stale", receipt.runId]);
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.equal(parse(cleared).status, "stale-lock-cleared");
});
