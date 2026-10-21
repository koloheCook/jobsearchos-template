const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { cp, mkdtemp, readFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const here = __dirname;
const script = path.join(here, "daily-report.mjs");

async function fixtureCopy() {
  const root = await mkdtemp(path.join(os.tmpdir(), "jobsearchos-report-"));
  await cp(path.join(here, "test-data", "valid"), root, { recursive: true });
  return root;
}

test("daily-report summarizes today's scored roles and what waits on the user", async () => {
  const root = await fixtureCopy();
  const run = spawnSync(process.execPath, [script, "--root", root, "--today", "2026-07-12"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const report = await readFile(path.join(root, "reports", "2026-07-12.md"), "utf8");
  assert.match(report, /^# Job search report 2026-07-12/);
  assert.match(report, /\| EXPLORE \| harbor-example_service-operations-lead_2026-07-12 \|/);
  assert.match(report, /PURSUE, not yet confirmed: fictional-systems_platform-operations-lead_2026-07-13/);
  assert.match(report, /The job-board check has not run today/);
});

test("daily-report on an empty folder still writes a readable report", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jobsearchos-report-empty-"));
  const run = spawnSync(process.execPath, [script, "--root", root, "--today", "2026-10-21"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const report = await readFile(path.join(root, "reports", "2026-10-21.md"), "utf8");
  assert.match(report, /No jobs were scored today/);
  assert.match(report, /0 scored: 0 PURSUE, 0 EXPLORE, 0 PASS/);
});
