#!/usr/bin/env node
// board-watch: poll ATS board APIs, diff against the last snapshot, emit new
// on-target posting URLs for capture-url to turn into captures.
//
// Emits URLs only. It never writes a capture, never touches landing/, never
// writes to any tracker, and never assigns a verdict. jd-intake owns all of that.

import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchBoard } from "./lib/adapters.mjs";
import { diffBoard, snapshotFromPostings, SKIP_REASONS } from "./lib/diff.mjs";
import { requisitionKey } from "../scripts/requisition-key.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_EMIT = 25; // capture-url caps at 100; stay well under so one bad day cannot flood landing/

function parseArgs(argv) {
  const options = { root: HERE, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root" && argv[i + 1]) options.root = path.resolve(argv[++i]);
    else if (argv[i] === "--dry-run") options.dryRun = true;
    else throw new Error(`unknown or incomplete argument: ${argv[i]}`);
  }
  return options;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function applicationKey(url) {
  try {
    return requisitionKey(url);
  } catch {
    return null;
  }
}

function compactErrorPart(value) {
  return String(value ?? "")
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function fetchErrorDetail(error) {
  const message = compactErrorPart(error?.message) || "fetch failed";
  const code = compactErrorPart(error?.cause?.code || error?.code);
  return code && !message.includes(code) ? `${message} (code ${code})` : message;
}

async function readDeclinedApplicationKeys(filename) {
  const mirror = await readJson(filename, null);
  if (mirror === null) return new Set();
  if (!Array.isArray(mirror.rows)) throw new Error(`decline mirror ${filename} has no rows array`);
  const keys = new Set();
  for (const row of mirror.rows) {
    if (row?.interest !== "Not Interested" || typeof row.applicationUrl !== "string") continue;
    const key = applicationKey(row.applicationUrl);
    if (key) keys.add(key);
  }
  return keys;
}

function suppressDeclined(postings, declinedKeys) {
  const emitted = [];
  const suppressed = [];
  for (const posting of postings) {
    const key = applicationKey(posting.url);
    if (key && declinedKeys.has(key)) suppressed.push({ ...posting, requisitionKey: key });
    else emitted.push(posting);
  }
  return { emitted, suppressed };
}

export async function run({ root, dryRun, fetchImpl, declineMirrorPath = path.resolve(root, "..", "data", "tracker-mirror.json") }) {
  const config = await readJson(path.join(root, "boards.json"), null);
  if (!config) throw new Error("boards.json not found");
  const declinedKeys = await readDeclinedApplicationKeys(declineMirrorPath);
  const statePath = path.join(root, "state", "snapshot.json");
  const seenPath = path.join(root, "state", "emitted.json");
  const state = await readJson(statePath, { boards: {} });
  const emitted = await readJson(seenPath, { ids: [] });
  const seenIds = new Set(emitted.ids);

  const results = [];
  const nextBoards = { ...state.boards };

  for (const board of config.boards.filter((b) => b.enabled !== false)) {
    let current = null;
    let error = null;
    try {
      current = await fetchBoard(board, fetchImpl);
    } catch (caught) {
      error = fetchErrorDetail(caught);
    }
    const result = diffBoard({
      org: board.org,
      prior: state.boards[board.org]?.postings ?? null,
      current,
      error,
      target: config.target,
      seenIds,
    });
    results.push(result);
    // A skipped board keeps its previous snapshot. Never overwrite good state with a bad fetch.
    if (!result.skipped || result.skipped === "seed_only") {
      nextBoards[board.org] = { fetchedAt: new Date().toISOString(), postings: snapshotFromPostings(current) };
    }
  }

  const added = results.flatMap((r) => r.added.map((p) => ({ ...p, org: r.org })));
  const { emitted: eligible, suppressed: suppressedDeclines } = suppressDeclined(added, declinedKeys);
  const capped = eligible.slice(0, MAX_EMIT);
  const deferred = eligible.slice(MAX_EMIT);
  const overflow = deferred.length;

  // Deferred and declined postings remain absent from the snapshot. Deferred roles must be
  // retried after the cap clears, and declined roles must be re-evaluated if the owner later
  // removes the decline from the tracker mirror.
  for (const posting of [...deferred, ...suppressedDeclines]) {
    delete nextBoards[posting.org]?.postings[posting.atsId];
  }

  if (!dryRun) {
    await mkdir(path.join(root, "state"), { recursive: true });
    await mkdir(path.join(root, "out"), { recursive: true });
    await writeFile(statePath, `${JSON.stringify({ boards: nextBoards }, null, 2)}\n`);
    for (const posting of capped) seenIds.add(`${posting.org}:${posting.atsId}`);
    await writeFile(seenPath, `${JSON.stringify({ ids: [...seenIds] }, null, 2)}\n`);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(root, "out", "new-urls.txt"), capped.map((p) => p.url).join("\n") + (capped.length ? "\n" : ""));
    await writeFile(path.join(root, "out", `run-${stamp}.json`), `${JSON.stringify({ generatedAt: new Date().toISOString(), results, emitted: capped, suppressedDeclines, overflow }, null, 2)}\n`);
  }

  return { results, emitted: capped, suppressedDeclines, overflow };
}

function report({ results, emitted, suppressedDeclines, overflow }) {
  for (const r of results) {
    if (r.skipped === "seed_only") console.log(`  ${r.org}: first check, saved a baseline (${r.detail}); only postings added after today count as new`);
    else if (r.skipped) console.log(`  ${r.org}: SKIPPED (${r.skipped}) ${r.detail}`);
    else console.log(`  ${r.org}: ${r.counts.prior} -> ${r.counts.current}, ${r.added.length} new on-target`);
  }
  console.log(`emitted ${emitted.length} url(s)${overflow > 0 ? `, ${overflow} held back by the cap` : ""}`);
  for (const p of emitted) console.log(`  ${p.org}: ${p.title} | ${p.location} | ${p.url}`);
  if (suppressedDeclines.length > 0) {
    console.log(`suppressed ${suppressedDeclines.length} declined url(s)`);
    for (const p of suppressedDeclines) console.log(`  ${p.org}: ${p.title} | ${p.url}`);
  }
}

export function allBoardsFetchFailed(results) {
  return results.length > 0 && results.every((result) => result.skipped === SKIP_REASONS.FETCH_FAILED);
}

function allBoardsFailureDetail(results) {
  return results.map((result) => `${result.org}=${result.detail}`).join("; ");
}

// Main-module check. import.meta.url is the percent-encoded realpath (this repo's path has a
// space; macOS tmpdirs are symlinks), so argv[1] must be realpath'd and URL-encoded before comparing.
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  run(parseArgs(process.argv.slice(2)))
    .then((result) => {
      report(result);
      if (allBoardsFetchFailed(result.results)) {
        console.error(`board-watch: every enabled board fetch failed: ${allBoardsFailureDetail(result.results)}`);
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(`board-watch: ${error.message}`);
      process.exitCode = 1;
    });
}
