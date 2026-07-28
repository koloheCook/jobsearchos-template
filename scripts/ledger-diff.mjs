#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { CAPTURE_DIRECTORY, parseCaptureMarkdown } from "../capture/lib/capture-format.mjs";

const CONTROL_FILES = new Set(["_ledger.md", "_runs.md", "README.md"]);
const LEDGER_ROW = /^\| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| ([^|]+) \| ([^|]+) \| (PURSUE|EXPLORE|PASS) \| ([^|]+) \|$/;

function parseArgs(argv) {
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) {
      root = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { root };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidMinute(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getUTCHours() === hour
    && parsed.getUTCMinutes() === minute;
}

function parseLedger(content) {
  const processed = new Set();
  const problems = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.startsWith("| ") || line.startsWith("| Processed ") || /^\| [-:| ]+\|$/.test(line)) continue;
    const match = LEDGER_ROW.exec(line);
    if (!match) {
      problems.push(`landing/_ledger.md line ${index + 1} does not match the ledger row grammar`);
      continue;
    }
    if (!isValidMinute(match[1])) {
      problems.push(`landing/_ledger.md line ${index + 1} has an invalid date or time: ${match[1]}`);
    }
    processed.add(match[2].trim());
  }
  return { processed, problems };
}

function inferSlug(filename) {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension);
  const named = /^(.*?)\s+\(([^()]+)\)$/.exec(stem);
  if (named) {
    return `${slug(named[2])}_${slug(named[1])}`;
  }
  return slug(stem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const landingDir = path.join(root, "landing");
  const ledgerPath = path.join(landingDir, "_ledger.md");
  const ledger = await readFile(ledgerPath, "utf8");
  const { processed, problems } = parseLedger(ledger);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`ledger-diff: ${problem}`);
    process.exitCode = 1;
    return;
  }

  const entries = await readdir(landingDir, { withFileTypes: true });
  const pdfs = entries
    .filter((entry) => entry.isFile() && !CONTROL_FILES.has(entry.name) && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((filename) => filename.toLowerCase().endsWith(".pdf"));
  const captureDir = path.join(landingDir, CAPTURE_DIRECTORY);
  let webCaptures = [];
  try {
    const captureEntries = await readdir(captureDir, { withFileTypes: true });
    for (const entry of captureEntries) {
      if (!entry.isFile() || !entry.name.endsWith(".jd.md")) continue;
      const relative = path.posix.join(CAPTURE_DIRECTORY, entry.name);
      try {
        const parsed = parseCaptureMarkdown(await readFile(path.join(captureDir, entry.name), "utf8"));
        webCaptures.push({ filename: relative, sourceType: parsed.frontmatter.source_type, pairedSource: parsed.frontmatter.source_snapshot ? path.posix.join(CAPTURE_DIRECTORY, parsed.frontmatter.source_snapshot) : null });
      } catch (error) {
        console.error(`ledger-diff: ${relative} is not a complete web capture: ${error.message}`);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const files = [...pdfs.map((filename) => ({ filename, sourceType: "pdf", pairedSource: null })), ...webCaptures]
    .filter((entry) => !processed.has(entry.filename))
    .sort((left, right) => compareText(left.filename, right.filename));

  const collisions = new Map();
  const unprocessed = files.map(({ filename, sourceType, pairedSource }) => {
    const baseSlug = inferSlug(filename);
    const count = (collisions.get(baseSlug) ?? 0) + 1;
    collisions.set(baseSlug, count);
    return {
      filename,
      inferredSlug: count === 1 ? baseSlug : `${baseSlug}-${count}`,
      sourceType,
      pairedSource,
    };
  });

  process.stdout.write(`${JSON.stringify(unprocessed, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`ledger-diff: ${error.message}`);
  process.exitCode = 1;
});
