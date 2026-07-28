#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { CAPTURE_DIRECTORY, parseCaptureMarkdown, sha256 } from "../capture/lib/capture-format.mjs";

const BANNER = /^## VERDICT: (PURSUE|EXPLORE|PASS)\b/;
const SCORES = /^Role-fits-you: (10|[0-9])\/10 \| You-fit-role: (10|[0-9])\/10 \| Gate: (RESOLVED-PASS|RESOLVED-FAIL|UNRESOLVED)$/;
const CONFIRMATION = /^Confirmed: (PURSUE|EXPLORE|PASS) by owner (\d{4}-\d{2}-\d{2})$/;
const LEDGER_ROW = /^\| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| ([^|]+) \| ([^|]+) \| (PURSUE|EXPLORE|PASS) \| ([^|]+) \|$/;
const RUN_ROW = /^\| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| (scheduled|manual) \| found=(\d+) \| processed=(\d+) \| pursue=(\d+) explore=(\d+) pass=(\d+) \| generatedAt=([^| ]+) \|$/;
const FOLDER = /^([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:-[a-z0-9]+)*)_(\d{4}-\d{2}-\d{2})(?:-\d+)?$/;

function parseArgs(argv) {
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) root = path.resolve(argv[++index]);
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { root };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isIso(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isMinute(value) {
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

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

async function readJson(root, relativePath, problems) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    problems.push(`${relativePath} could not be parsed as JSON: ${error.message}`);
    return null;
  }
}

function validateManifest(manifest, problems) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return;
  if (manifest.schemaVersion !== 1) problems.push("out/mc/jobsearch-manifest.json schemaVersion must be 1");
  if (!isIso(manifest.generatedAt)) problems.push("out/mc/jobsearch-manifest.json generatedAt must be ISO-8601 parseable");
  if (!manifest.pipeline || typeof manifest.pipeline !== "object" || Array.isArray(manifest.pipeline)) {
    problems.push("out/mc/jobsearch-manifest.json pipeline must be an object");
  } else {
    const byStage = manifest.pipeline.byStage;
    if (!byStage || typeof byStage !== "object" || Array.isArray(byStage)) {
      problems.push("out/mc/jobsearch-manifest.json pipeline.byStage must be an object");
    } else {
      for (const [stage, count] of Object.entries(byStage)) {
        if (!stage || !isNonNegativeInteger(count)) problems.push(`out/mc/jobsearch-manifest.json pipeline.byStage.${stage || "<empty>"} must be a non-negative integer`);
      }
      const stageTotal = Object.values(byStage).reduce((sum, count) => sum + (isNonNegativeInteger(count) ? count : 0), 0);
      if (isNonNegativeInteger(manifest.pipeline.total) && manifest.pipeline.total !== stageTotal) {
        problems.push(`out/mc/jobsearch-manifest.json pipeline.total is ${manifest.pipeline.total}, but stage counts sum to ${stageTotal}`);
      }
    }
    if (!isNonNegativeInteger(manifest.pipeline.total)) problems.push("out/mc/jobsearch-manifest.json pipeline.total must be a non-negative integer");
    if (!isNonNegativeInteger(manifest.pipeline.missingNextStepDate)) problems.push("out/mc/jobsearch-manifest.json pipeline.missingNextStepDate must be a non-negative integer");
  }

  for (const field of ["overdue", "todayMeetings", "pendingVerdicts", "newSinceYesterday"]) {
    if (!Array.isArray(manifest[field])) problems.push(`out/mc/jobsearch-manifest.json ${field} must be an array`);
  }
  const overdue = Array.isArray(manifest.overdue) ? manifest.overdue : [];
  const todayMeetings = Array.isArray(manifest.todayMeetings) ? manifest.todayMeetings : [];
  const pendingVerdicts = Array.isArray(manifest.pendingVerdicts) ? manifest.pendingVerdicts : [];
  const newSinceYesterday = Array.isArray(manifest.newSinceYesterday) ? manifest.newSinceYesterday : [];
  for (const [index, item] of overdue.entries()) {
    if (!item || typeof item.opportunity !== "string" || typeof item.nextStep !== "string" || !isDate(item.due)) {
      problems.push(`out/mc/jobsearch-manifest.json overdue item ${index + 1} is invalid`);
    }
  }
  for (const [index, item] of todayMeetings.entries()) {
    if (!item || typeof item.opportunity !== "string" || !/^\d{2}:\d{2}$/.test(item.time) || typeof item.briefReady !== "boolean") {
      problems.push(`out/mc/jobsearch-manifest.json todayMeetings item ${index + 1} is invalid`);
    }
  }
  for (const [index, item] of pendingVerdicts.entries()) {
    if (!item || typeof item.opportunity !== "string" || !["PURSUE", "EXPLORE", "PASS"].includes(item.verdict) || typeof item.awaiting !== "string") {
      problems.push(`out/mc/jobsearch-manifest.json pendingVerdicts item ${index + 1} is invalid`);
    }
  }
  for (const [index, item] of newSinceYesterday.entries()) {
    if (typeof item !== "string" || item.length === 0) problems.push(`out/mc/jobsearch-manifest.json newSinceYesterday item ${index + 1} must be a non-empty string`);
  }
}

async function validateTable(root, relativePath, kind, rowPattern, problems) {
  let content;
  try {
    content = await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && kind === "runs") return;
    problems.push(`${relativePath} could not be read: ${error.message}`);
    return;
  }
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.startsWith("| ") || /^\| [-:| ]+\|$/.test(line)) continue;
    if ((kind === "ledger" && line.startsWith("| Processed ")) || (kind === "runs" && line.startsWith("| Run at "))) continue;
    const match = rowPattern.exec(line);
    if (!match) {
      problems.push(`${relativePath} line ${index + 1} does not match the ${kind} row grammar`);
      continue;
    }
    if (!isMinute(match[1])) problems.push(`${relativePath} line ${index + 1} has an invalid date or time: ${match[1]}`);
    if (kind === "runs" && !isIso(match[8])) problems.push(`${relativePath} line ${index + 1} has an invalid generatedAt value: ${match[8]}`);
  }
}

async function listFolders(root, problems) {
  let entries;
  try {
    entries = await readdir(path.join(root, "opportunities"), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    problems.push(`opportunities/ could not be read: ${error.message}`);
    return [];
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function validateAssessment(root, folder, problems) {
  const relativePath = `opportunities/${folder}/assessment.md`;
  let content;
  try {
    content = await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    problems.push(`${relativePath} could not be read: ${error.message}`);
    return;
  }
  const lines = content.split(/\r?\n/);
  const bannerIndex = lines.findIndex((line) => line.startsWith("## VERDICT:"));
  if (bannerIndex === -1) {
    problems.push(`${relativePath} is missing a verdict banner`);
    return;
  }
  if (!BANNER.test(lines[bannerIndex])) problems.push(`${relativePath} has a verdict banner that does not match grammar v1`);
  if (!SCORES.test(lines[bannerIndex + 1] ?? "")) problems.push(`${relativePath} has an invalid scores line directly below the verdict banner`);
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith("Confirmed:")) continue;
    const match = CONFIRMATION.exec(line);
    if (!match || !isDate(match[2])) problems.push(`${relativePath} line ${index + 1} has an invalid owner confirmation`);
  }
}

async function validateMirror(root, folders, problems) {
  const relativePath = "data/tracker-mirror.json";
  let mirror;
  try {
    mirror = JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    problems.push(`${relativePath} could not be parsed as JSON: ${error.message}`);
    return;
  }
  if (!Array.isArray(mirror.rows)) {
    problems.push(`${relativePath} rows must be an array`);
    return;
  }
  const folderKeys = new Set(folders.map((folder) => slug(folder)));
  for (const [index, row] of mirror.rows.entries()) {
    if (row.folderPointer && !folderKeys.has(slug(row.folderPointer))) {
      problems.push(`${relativePath} row ${index + 1} folderPointer does not resolve: ${row.folderPointer}`);
    }
  }
}

async function validateWebCaptures(root, problems) {
  const directory = path.join(root, "landing", CAPTURE_DIRECTORY);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    problems.push(`landing/${CAPTURE_DIRECTORY}/ could not be read: ${error.message}`);
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jd.md")) continue;
    const relative = `landing/${CAPTURE_DIRECTORY}/${entry.name}`;
    try {
      const parsed = parseCaptureMarkdown(await readFile(path.join(directory, entry.name), "utf8"));
      if (!parsed.frontmatter.source_snapshot) continue;
      const snapshotPath = path.join(directory, parsed.frontmatter.source_snapshot);
      const snapshot = await readFile(snapshotPath, "utf8");
      if (sha256(snapshot) !== parsed.frontmatter.source_snapshot_sha256) {
        problems.push(`${relative} source snapshot hash does not match`);
      }
    } catch (error) {
      problems.push(`${relative} is not a valid complete web capture: ${error.message}`);
    }
  }
}

async function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const problems = [];
  const manifest = await readJson(root, "out/mc/jobsearch-manifest.json", problems);
  validateManifest(manifest, problems);
  await validateTable(root, "landing/_ledger.md", "ledger", LEDGER_ROW, problems);
  await validateTable(root, "landing/_runs.md", "runs", RUN_ROW, problems);
  await validateWebCaptures(root, problems);
  const folders = await listFolders(root, problems);
  for (const folder of folders) {
    const match = FOLDER.exec(folder);
    if (!match || !isDate(match[3])) problems.push(`opportunities/${folder} does not match the folder grammar`);
    await validateAssessment(root, folder, problems);
  }
  await validateMirror(root, folders, problems);

  if (problems.length > 0) {
    console.error(`validate-output: found ${problems.length} problem(s)`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("validate-output: OK");
}

main().catch((error) => {
  console.error(`validate-output: ${error.message}`);
  process.exitCode = 1;
});
