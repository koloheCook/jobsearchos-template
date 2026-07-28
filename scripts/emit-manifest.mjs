#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
// PRD 6.B2 live-row filter. The mirror query only admits these five, so any other
// value means the mirror is malformed, stale-in-a-bad-way, or hand-edited. Report it
// rather than publishing it onward to an external status dashboard.
const ALLOWED_STATUSES = new Set(["Not Applied", "Applied", "AI Screen", "Phone Screen", "Interview"]);
const BANNER = /^## VERDICT: (PURSUE|EXPLORE|PASS)\b/;
const SCORES = /^Role-fits-you: (10|[0-9])\/10 \| You-fit-role: (10|[0-9])\/10 \| Gate: (RESOLVED-PASS|RESOLVED-FAIL|UNRESOLVED)$/;
const CONFIRMATION = /^Confirmed: (PURSUE|EXPLORE|PASS) by owner (\d{4}-\d{2}-\d{2})$/;
const FOLDER = /^([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:-[a-z0-9]+)*)_(\d{4}-\d{2}-\d{2})(?:-\d+)?$/;

function parseArgs(argv) {
  let root = process.cwd();
  let generatedAt = new Date().toISOString();
  let today = localDate(new Date());
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" && argv[index + 1]) root = path.resolve(argv[++index]);
    else if (argument === "--generated-at" && argv[index + 1]) generatedAt = argv[++index];
    else if (argument === "--today" && argv[index + 1]) today = argv[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!isIso(generatedAt)) throw new Error(`generatedAt is not valid ISO-8601: ${generatedAt}`);
  if (!isDate(today)) throw new Error(`today is not a valid date: ${today}`);
  return { root, generatedAt, today };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIso(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function listOpportunityFolders(root) {
  const directory = path.join(root, "opportunities");
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(compareText);
}

async function readAssessment(root, folder) {
  const relativePath = `opportunities/${folder}/assessment.md`;
  let content;
  try {
    content = await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    return { problems: [`${relativePath} could not be read: ${error.message}`] };
  }
  const lines = content.split(/\r?\n/);
  const bannerIndex = lines.findIndex((line) => line.startsWith("## VERDICT:"));
  if (bannerIndex === -1) return { problems: [`${relativePath} is missing a verdict banner`] };
  const banner = BANNER.exec(lines[bannerIndex]);
  const problems = [];
  if (!banner) problems.push(`${relativePath} has a verdict banner that does not match grammar v1`);
  if (!SCORES.test(lines[bannerIndex + 1] ?? "")) {
    problems.push(`${relativePath} has an invalid scores line directly below the verdict banner`);
  }
  let confirmed = false;
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith("Confirmed:")) continue;
    const match = CONFIRMATION.exec(line);
    if (!match || !isDate(match[2])) problems.push(`${relativePath} line ${index + 1} has an invalid owner confirmation`);
    else confirmed = true;
  }
  return { verdict: banner?.[1], confirmed, problems };
}

async function readMirror(root, generatedAt, folders) {
  const mirrorPath = path.join(root, "data", "tracker-mirror.json");
  let mirror;
  try {
    mirror = JSON.parse(await readFile(mirrorPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { status: "absent", ageDays: null, rows: [], problems: [] };
    return { status: "invalid", ageDays: null, rows: [], problems: [`data/tracker-mirror.json could not be parsed: ${error.message}`] };
  }
  if (!isIso(mirror.syncedAt) || !Array.isArray(mirror.rows)) {
    return { status: "invalid", ageDays: null, rows: [], problems: ["data/tracker-mirror.json must have ISO-8601 syncedAt and a rows array"] };
  }
  const ageDays = Math.max(0, (Date.parse(generatedAt) - Date.parse(mirror.syncedAt)) / DAY_MS);
  const status = ageDays <= 1 ? "fresh" : ageDays <= 3 ? "aging" : "stale";
  const folderKeys = new Set(folders.map((folder) => slug(folder)));
  const problems = [];
  for (const [index, row] of mirror.rows.entries()) {
    if (!ALLOWED_STATUSES.has(row.applicationStatus)) {
      problems.push(`data/tracker-mirror.json row ${index + 1} has an applicationStatus outside the 6.B2 live-row filter: ${JSON.stringify(row.applicationStatus ?? null)}`);
    }
    if (row.folderPointer && !folderKeys.has(slug(row.folderPointer))) {
      problems.push(`data/tracker-mirror.json row ${index + 1} folderPointer does not resolve: ${row.folderPointer}`);
    }
  }
  return { status, ageDays, rows: status === "stale" ? [] : mirror.rows, problems };
}

function mirrorCounts(rows, folders, today) {
  const byStage = {};
  let missingNextStepDate = 0;
  const overdue = [];
  const folderByKey = new Map(folders.map((folder) => [slug(folder), folder]));
  for (const row of rows) {
    // readMirror has already rejected any row whose status is outside the 6.B2
    // filter, so every row buckets and pipeline.total always equals the stage sum.
    const stage = slug(row.applicationStatus);
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    if (!row.nextStepDate) missingNextStepDate += 1;
    if (isDate(row.nextStepDate) && row.nextStepDate < today) {
      const matchedFolder = row.folderPointer ? folderByKey.get(slug(row.folderPointer)) : null;
      overdue.push({
        opportunity: matchedFolder ?? `${slug(row.company ?? "unknown")}_${slug(row.role ?? "unknown")}`,
        nextStep: row.nextStep ?? "Next step not recorded",
        due: row.nextStepDate,
      });
    }
  }
  return { byStage, total: rows.length, missingNextStepDate, overdue };
}

async function main() {
  const { root, generatedAt, today } = parseArgs(process.argv.slice(2));
  const folders = await listOpportunityFolders(root);
  const problems = [];
  const assessments = [];
  for (const folder of folders) {
    const match = FOLDER.exec(folder);
    if (!match || !isDate(match?.[3])) {
      problems.push(`opportunities/${folder} does not match the folder grammar`);
      continue;
    }
    const assessment = await readAssessment(root, folder);
    problems.push(...assessment.problems);
    assessments.push({ folder, ...assessment });
  }

  const mirror = await readMirror(root, generatedAt, folders);
  problems.push(...mirror.problems);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`emit-manifest: ${problem}`);
    process.exitCode = 1;
    return;
  }

  const counts = mirrorCounts(mirror.rows, folders, today);
  const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    note: `Tracker mirror status: ${mirror.status}${mirror.ageDays === null ? "" : ` (${mirror.ageDays.toFixed(2)} days old)`}.`,
    pipeline: {
      byStage: Object.fromEntries(Object.entries(counts.byStage).sort(([left], [right]) => compareText(left, right))),
      total: counts.total,
      missingNextStepDate: counts.missingNextStepDate,
    },
    overdue: counts.overdue.sort((left, right) => compareText(left.opportunity, right.opportunity)),
    todayMeetings: [],
    pendingVerdicts: assessments
      .filter((assessment) => assessment.verdict === "PURSUE" && !assessment.confirmed)
      .map((assessment) => ({ opportunity: assessment.folder, verdict: "PURSUE", awaiting: "owner confirmation" })),
    newSinceYesterday: folders.filter((folder) => FOLDER.exec(folder)?.[3] >= yesterday),
  };

  const outputPath = path.join(root, "out", "mc", "jobsearch-manifest.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`emit-manifest: wrote ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(`emit-manifest: ${error.message}`);
  process.exitCode = 1;
});
