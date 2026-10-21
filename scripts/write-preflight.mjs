#!/usr/bin/env node

// Path-scoped preflight: blocks only when a path this session will write is
// already dirty, or when any path in the tree is unmerged. Unrelated dirt is
// reported as a count so another session's work never stops this one.

import { spawnSync } from "node:child_process";
import path from "node:path";

const UNMERGED = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function parseArgs(argv) {
  let root = process.cwd();
  const paths = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" && argv[index + 1]) {
      root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown argument: ${argument}`);
    } else {
      paths.push(argument.replaceAll(path.sep, "/").replace(/\/+$/, ""));
    }
  }
  if (paths.length === 0) throw new Error("name at least one path this session will write");
  return { paths, root };
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
  const records = result.stdout.split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    entries.push({ path: record.slice(3), status });
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      entries.push({ path: records[index] ?? "", status });
    }
  }
  return entries;
}

function overlaps(file, target) {
  return file === target || file.startsWith(`${target}/`) || target.startsWith(`${file}/`);
}

function main() {
  const { paths, root } = parseArgs(process.argv.slice(2));
  const blocking = [];
  let unrelated = 0;
  for (const entry of gitStatus(root)) {
    if (UNMERGED.has(entry.status)) blocking.push({ ...entry, reason: "unmerged" });
    else if (paths.some((target) => overlaps(entry.path, target))) {
      blocking.push({ ...entry, reason: "planned write path is dirty" });
    } else unrelated += 1;
  }
  const status = blocking.length === 0 ? "clear" : "blocked";
  process.stdout.write(`${JSON.stringify({ status, blocking, unrelatedDirty: unrelated })}\n`);
  if (status === "blocked") process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(`write-preflight: ${error.message}`);
  process.exitCode = 1;
}
