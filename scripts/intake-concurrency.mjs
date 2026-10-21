#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const RUNTIME_DIRECTORY = ".jobsearchos-runtime";
const LOCK_DIRECTORY = "jd-intake.lock";
const OWNER_FILE = "owner.json";
const EXPECTED_DIRTY = new Map([
  ["landing/_ledger.md", new Set([" M"])],
  ["landing/_runs.md", new Set([" M", "??"])],
  ["out/mc/jobsearch-manifest.json", new Set([" M"])],
]);
const PROTECTED_EXACT = new Set(["AGENTS.md", "CLAUDE.md", "PRD.md", ".claude/skills/jd-intake"]);
const PROTECTED_PREFIXES = [
  ".agents/skills/jd-intake/",
  ".claude/skills/jd-intake/",
  "playbook/",
  "rubric/",
  "scripts/",
  "templates/",
];
const UNMERGED = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function fail(message, code = 1) {
  console.error(`intake-concurrency: ${message}`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const command = argv[0];
  let root = process.cwd();
  let mode;
  let token;
  let staleRunId;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--root" && value) root = path.resolve(value);
    else if (argument === "--mode" && value) mode = value;
    else if (argument === "--token" && value) token = value;
    else if (argument === "--confirm-stale" && value) staleRunId = value;
    else throw new Error(`unknown or incomplete argument: ${argument}`);
    index += 1;
  }
  if (!new Set(["acquire", "clear-stale", "inspect", "release"]).has(command)) {
    throw new Error("command must be acquire, clear-stale, inspect, or release");
  }
  if (command === "acquire" && !new Set(["scheduled", "manual"]).has(mode)) {
    throw new Error("acquire requires --mode scheduled or --mode manual");
  }
  if (command === "release" && !token) throw new Error("release requires --token");
  if (command === "clear-stale" && !staleRunId) {
    throw new Error("clear-stale requires --confirm-stale <runId>");
  }
  return { command, mode, root, staleRunId, token };
}

function lockPaths(root) {
  const runtime = path.join(root, RUNTIME_DIRECTORY);
  const lock = path.join(runtime, LOCK_DIRECTORY);
  return { lock, owner: path.join(lock, OWNER_FILE), runtime };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeGitPath(value) {
  return value.replaceAll(path.sep, "/");
}

function parsePorcelain(output) {
  const records = output.split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== " ") {
      throw new Error(`unexpected git status record: ${JSON.stringify(record)}`);
    }
    const status = record.slice(0, 2);
    const entry = { path: normalizeGitPath(record.slice(3)), status };
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      entry.originalPath = normalizeGitPath(records[index] ?? "");
    }
    entries.push(entry);
  }
  return entries;
}

function isProtected(file) {
  return PROTECTED_EXACT.has(file)
    || PROTECTED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function classify(entries) {
  const allowed = [];
  const nonOverlapping = [];
  const blocking = [];
  for (const entry of entries) {
    if (entry.path.startsWith(`${RUNTIME_DIRECTORY}/`)) continue;
    const paths = [entry.path, entry.originalPath].filter(Boolean);
    if (UNMERGED.has(entry.status)) {
      blocking.push({ ...entry, reason: "unmerged path" });
      continue;
    }
    if (paths.some(isProtected)) {
      blocking.push({ ...entry, reason: "protected path is dirty" });
      continue;
    }
    const expected = EXPECTED_DIRTY.get(entry.path);
    if (expected) {
      if (expected.has(entry.status)) allowed.push(entry);
      else blocking.push({ ...entry, reason: "overlapping path has an unexpected or staged status" });
      continue;
    }
    nonOverlapping.push(entry);
  }
  const runsEntry = entries.find((entry) => entry.path === "landing/_runs.md");
  const receiptSafe = !runsEntry || EXPECTED_DIRTY.get("landing/_runs.md").has(runsEntry.status);
  return { allowed, blocking, nonOverlapping, receiptSafe };
}

function gitStatus(root) {
  const result = spawnSync("git", [
    "-C",
    root,
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git status exited ${result.status}`);
  }
  return parsePorcelain(result.stdout);
}

async function readOwner(ownerPath) {
  return JSON.parse(await readFile(ownerPath, "utf8"));
}

function publicOwner(owner) {
  const { tokenHash: _tokenHash, ...visible } = owner;
  return visible;
}

async function acquire(root, mode) {
  const paths = lockPaths(root);
  await mkdir(paths.runtime, { recursive: true });
  try {
    await mkdir(paths.lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner = null;
    try {
      owner = publicOwner(await readOwner(paths.owner));
    } catch {
      owner = { state: "unreadable" };
    }
    process.stdout.write(`${JSON.stringify({ status: "lock-held", owner })}\n`);
    process.exitCode = 73;
    return;
  }

  const token = randomUUID();
  const owner = {
    schemaVersion: 1,
    runId: randomUUID(),
    mode,
    acquiredAt: new Date().toISOString(),
    tokenHash: hashToken(token),
  };
  await writeFile(paths.owner, `${JSON.stringify(owner, null, 2)}\n`, { flag: "wx" });

  try {
    const classification = classify(gitStatus(root));
    const status = classification.blocking.length === 0 ? "ready" : "blocked";
    process.stdout.write(`${JSON.stringify({
      status,
      token,
      runId: owner.runId,
      allowedDirty: classification.allowed,
      nonOverlappingDirty: classification.nonOverlapping,
      blocking: classification.blocking,
      receiptSafe: classification.receiptSafe,
    })}\n`);
    if (status === "blocked") process.exitCode = 2;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      status: "blocked",
      token,
      runId: owner.runId,
      allowedDirty: [],
      nonOverlappingDirty: [],
      blocking: [{ reason: `preflight failed: ${error.message}` }],
      receiptSafe: false,
    })}\n`);
    process.exitCode = 2;
  }
}

async function inspect(root) {
  const paths = lockPaths(root);
  try {
    const owner = publicOwner(await readOwner(paths.owner));
    process.stdout.write(`${JSON.stringify({ status: "lock-held", owner })}\n`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    process.stdout.write(`${JSON.stringify({ status: "unlocked" })}\n`);
  }
}

async function release(root, token) {
  const paths = lockPaths(root);
  let owner;
  try {
    owner = await readOwner(paths.owner);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    fail("lock is not held", 74);
    return;
  }
  if (owner.tokenHash !== hashToken(token)) {
    fail("release token does not own the lock", 74);
    return;
  }
  await rm(paths.lock, { recursive: true });
  process.stdout.write(`${JSON.stringify({ status: "released", runId: owner.runId })}\n`);
}

async function clearStale(root, staleRunId) {
  const paths = lockPaths(root);
  let owner;
  try {
    owner = await readOwner(paths.owner);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    fail("lock is not held", 75);
    return;
  }
  if (owner.runId !== staleRunId) {
    fail("confirmed run id does not match the lock owner", 75);
    return;
  }
  await rm(paths.lock, { recursive: true });
  process.stdout.write(`${JSON.stringify({ status: "stale-lock-cleared", runId: owner.runId })}\n`);
}

async function main() {
  const { command, mode, root, staleRunId, token } = parseArgs(process.argv.slice(2));
  if (command === "acquire") await acquire(root, mode);
  else if (command === "inspect") await inspect(root);
  else if (command === "release") await release(root, token);
  else await clearStale(root, staleRunId);
}

main().catch((error) => fail(error.message));
