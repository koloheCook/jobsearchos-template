const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const scriptsDir = __dirname;
const fixturesDir = path.join(scriptsDir, "test-data");

function run(script, args, env = {}) {
  return spawnSync(process.execPath, [path.join(scriptsDir, script), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function copyFixture(name) {
  const destination = mkdtempSync(path.join(os.tmpdir(), `jobsearchos-${name}-`));
  cpSync(path.join(fixturesDir, name), destination, { recursive: true });
  return destination;
}

test("ledger-diff emits deterministic slugs, including collision and non-ASCII cases", () => {
  const result = run("ledger-diff.mjs", ["--root", path.join(fixturesDir, "valid")]);
  assert.equal(result.status, 0, result.stderr);
  const expected = readFileSync(path.join(fixturesDir, "expected", "ledger-diff.json"), "utf8");
  assert.equal(result.stdout, expected);
});

test("emit-manifest writes the schema v1 expected output", () => {
  const root = copyFixture("valid");
  const result = run("emit-manifest.mjs", [
    "--root",
    root,
    "--generated-at",
    "2026-07-13T18:00:00.000Z",
    "--today",
    "2026-07-13",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const actual = readFileSync(path.join(root, "out", "mc", "jobsearch-manifest.json"), "utf8");
  const expected = readFileSync(path.join(fixturesDir, "expected", "jobsearch-manifest.json"), "utf8");
  assert.equal(actual, expected);
});

test("validate-output accepts a manifest emit-manifest just wrote", () => {
  const root = copyFixture("valid");
  const emitted = run("emit-manifest.mjs", [
    "--root",
    root,
    "--generated-at",
    "2026-07-13T18:00:00.000Z",
    "--today",
    "2026-07-13",
  ]);
  assert.equal(emitted.status, 0, emitted.stderr);
  const validated = run("validate-output.mjs", ["--root", root]);
  assert.equal(validated.status, 0, `${validated.stdout}${validated.stderr}`);
});

test("emit-manifest fails closed on a status outside the 6.B2 live-row filter", () => {
  const root = copyFixture("invalid");
  const manifestPath = path.join(root, "out", "mc", "jobsearch-manifest.json");
  const before = readFileSync(manifestPath, "utf8");
  const result = run("emit-manifest.mjs", [
    "--root",
    root,
    "--generated-at",
    "2026-07-13T18:00:00.000Z",
    "--today",
    "2026-07-13",
  ]);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /row 2 has an applicationStatus outside the 6\.B2 live-row filter: null/,
  );
  // Fail closed: a rejected mirror must never reach an external status dashboard.
  assert.equal(readFileSync(manifestPath, "utf8"), before);
});

test("validate-output accepts the valid fixture tree", () => {
  const result = run("validate-output.mjs", ["--root", path.join(fixturesDir, "valid")]);
  assert.equal(result.status, 0, result.stderr);
  const expected = readFileSync(path.join(fixturesDir, "expected", "validate-valid.txt"), "utf8");
  assert.equal(result.stdout, expected);
});

test("validate-output reports every invalid fixture problem", () => {
  const result = run("validate-output.mjs", ["--root", path.join(fixturesDir, "invalid")]);
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 1);
  const expected = readFileSync(path.join(fixturesDir, "expected", "validate-invalid.txt"), "utf8");
  assert.equal(output, expected);
});

test("refresh-tracker-mirror writes schema v1 and reports optional tracker properties", () => {
  const trackerPageUrl = "https://example.invalid/invented-role";
  const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-refresh-"));
  const result = run("refresh-tracker-mirror.mjs", [
    "--root",
    root,
    "--api-fixture",
    path.join(fixturesDir, "notion-api", "refresh-response.json"),
    "--synced-at",
    "2026-07-14T20:00:00.000Z",
  ], { JOBSEARCHOS_TEST_MODE: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /wrote data\/tracker-mirror\.json \(1 rows\)/);
  const mirror = JSON.parse(readFileSync(path.join(root, "data", "tracker-mirror.json"), "utf8"));
  assert.deepEqual(mirror, {
    schemaVersion: 1,
    syncedAt: "2026-07-14T20:00:00.000Z",
    source: {
      databaseId: "<YOUR_NOTION_DATABASE_ID>",
      dataSourceUrl: "collection://<YOUR_NOTION_DATA_SOURCE_ID>",
      liveFilter: "Application Status in [Not Applied, Applied, AI Screen, Phone Screen, Interview]",
    },
    rowCount: 1,
    rows: [{
      notionUrl: trackerPageUrl,
      role: "Invented Operations Lead",
      company: "Fictional Systems",
      applicationStatus: "Applied",
      ccStatus: "Stage1",
      interest: "High",
      dateApplied: "2026-07-13",
      lastEdited: "2026-07-13T15:00:00.000Z",
      nextStep: null,
      nextStepDate: null,
      folderPointer: null,
      applicationUrl: null,
    }],
    validation: {
      missingProperties: ["Next Step", "Next Step Date", "jobSearchOS Folder", "Application"],
      missingNextStepDate: [trackerPageUrl],
      pointerMissing: [trackerPageUrl],
      pointerBroken: [],
      companyUnresolved: [],
    },
  });
});

test("refresh-tracker-mirror fails closed when NO live row resolves a company (systemic company-source failure)", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-refresh-invalid-"));
  const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "notion-api", "refresh-response.json"), "utf8"));
  fixture.companyPages = [];
  const fixturePath = path.join(root, "unresolved-company.json");
  writeFileSync(fixturePath, JSON.stringify(fixture), "utf8");
  const outputPath = path.join(root, "data", "tracker-mirror.json");
  const priorMirror = "{\"known\":\"good\"}\n";
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, priorMirror, "utf8");
  const result = run("refresh-tracker-mirror.mjs", [
    "--root",
    root,
    "--api-fixture",
    fixturePath,
    "--synced-at",
    "2026-07-14T20:00:00.000Z",
  ], { JOBSEARCHOS_TEST_MODE: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no live tracker row resolved a company through <YOUR_NOTION_COMPANY_SOURCE_ID>/);
  // Fail closed: when the whole company source is missing, the known-good mirror is preserved.
  assert.equal(readFileSync(outputPath, "utf8"), priorMirror);
});

test("refresh-tracker-mirror quarantines a single company-less row and keeps the resolvable ones", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-refresh-quarantine-"));
  const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "notion-api", "refresh-response.json"), "utf8"));
  const goodPage = fixture.trackerPages[0];
  const goodUrl = goodPage.url;
  const orphanUrl = "https://example.invalid/no-company-role";
  const orphanPage = JSON.parse(JSON.stringify(goodPage));
  orphanPage.id = "33333333-3333-4333-8333-333333333333";
  orphanPage.url = orphanUrl;
  orphanPage.properties["🏢 Company"] = { type: "relation", relation: [] };
  fixture.trackerPages = [goodPage, orphanPage];
  const fixturePath = path.join(root, "quarantine.json");
  writeFileSync(fixturePath, JSON.stringify(fixture), "utf8");
  const result = run("refresh-tracker-mirror.mjs", [
    "--root",
    root,
    "--api-fixture",
    fixturePath,
    "--synced-at",
    "2026-07-14T20:00:00.000Z",
  ], { JOBSEARCHOS_TEST_MODE: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /wrote data\/tracker-mirror\.json \(1 rows\)/);
  assert.match(result.stderr, /1 row\(s\) skipped -- no company set in Notion/);
  const mirror = JSON.parse(readFileSync(path.join(root, "data", "tracker-mirror.json"), "utf8"));
  assert.equal(mirror.rowCount, 1);
  assert.equal(mirror.rows.length, 1);
  assert.equal(mirror.rows[0].notionUrl, goodUrl);
  assert.equal(mirror.rows[0].company, "Fictional Systems");
  assert.deepEqual(mirror.validation.companyUnresolved, [orphanUrl]);
});
