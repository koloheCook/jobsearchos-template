import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchBoard, adapters } from "./lib/adapters.mjs";
import { diffBoard, snapshotFromPostings, SKIP_REASONS, matchesTarget } from "./lib/diff.mjs";
import { allBoardsFetchFailed, fetchErrorDetail, run } from "./board-watch.mjs";

const TARGET = {
  roleTerms: ["program manager", "operations"],
  domainTerms: [],
  excludeTitle: ["engineer", "scientist"],
};

const gh = (n, over = {}) => ({
  id: n, title: `Program Manager ${n}`, absolute_url: `https://boards.greenhouse.io/x/jobs/${n}`,
  location: { name: "San Francisco, CA" }, first_published: "2026-09-01T00:00:00Z", ...over,
});

function toNorm(job) {
  return adapters.greenhouse.parse({ jobs: [job] })[0];
}

test("greenhouse adapter normalizes the real field names", async () => {
  const out = await fetchBoard({ org: "a", ats: "greenhouse", token: "t" },
    async () => ({ jobs: [gh(1000000001, { title: "Operations Lead, Partners" })] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].atsId, "1000000001");
  assert.equal(out[0].title, "Operations Lead, Partners");
  assert.equal(out[0].location, "San Francisco, CA");
  assert.match(out[0].url, /^https:\/\//);
});

test("ashby adapter reads jobUrl and publishedAt", async () => {
  const out = await fetchBoard({ org: "o", ats: "ashby", token: "globex" },
    async () => ({ jobs: [{ id: "abc", title: "Program Manager, Ops", location: "SF",
      jobUrl: "https://jobs.ashbyhq.com/globex/abc", publishedAt: "2026-09-10T00:00:00Z" }] }));
  assert.equal(out[0].atsId, "abc");
  assert.equal(out[0].url, "https://jobs.ashbyhq.com/globex/abc");
});

test("lever adapter reads text and hostedUrl", async () => {
  const out = await fetchBoard({ org: "l", ats: "lever", token: "t" },
    async () => ([{ id: "l1", text: "Operations Manager", hostedUrl: "https://jobs.lever.co/t/l1",
      categories: { location: "Remote" }, createdAt: 1757000000000 }]));
  assert.equal(out[0].title, "Operations Manager");
  assert.equal(out[0].location, "Remote");
});

test("a non-HTTPS posting url is rejected rather than emitted", async () => {
  await assert.rejects(
    fetchBoard({ org: "a", ats: "greenhouse", token: "t" },
      async () => ({ jobs: [gh(1, { absolute_url: "http://insecure.example/j/1" })] })),
    /non-HTTPS/);
});

test("a malformed payload throws instead of returning an empty board", async () => {
  await assert.rejects(
    fetchBoard({ org: "a", ats: "greenhouse", token: "t" }, async () => ({ results: [] })),
    /no jobs array/);
});

test("first sight of a board seeds and emits nothing", () => {
  const r = diffBoard({ org: "a", prior: null, current: [gh(1), gh(2)].map(toNorm), target: TARGET });
  assert.equal(r.skipped, SKIP_REASONS.SEED);
  assert.equal(r.added.length, 0);
});

test("a failed fetch never reports removals or additions", () => {
  const r = diffBoard({ org: "a", prior: { "1": {} }, current: null, error: "HTTP 503", target: TARGET });
  assert.equal(r.skipped, SKIP_REASONS.FETCH_FAILED);
  assert.equal(r.added.length, 0);
});

test("fetch failures retain a safe underlying cause code", () => {
  const failure = new TypeError("fetch failed", { cause: Object.assign(new Error("not found"), { code: "ENOTFOUND" }) });
  assert.equal(fetchErrorDetail(failure), "fetch failed (code ENOTFOUND)");
});

test("all enabled boards failing is a chain-visible failure", () => {
  assert.equal(allBoardsFetchFailed([
    { skipped: SKIP_REASONS.FETCH_FAILED },
    { skipped: SKIP_REASONS.FETCH_FAILED },
  ]), true);
  assert.equal(allBoardsFetchFailed([
    { skipped: SKIP_REASONS.FETCH_FAILED },
    { skipped: null },
  ]), false);
  assert.equal(allBoardsFetchFailed([]), false);
});

test("an empty board is treated as a bad fetch, not as everything closing", () => {
  const r = diffBoard({ org: "a", prior: { "1": {} }, current: [], target: TARGET });
  assert.equal(r.skipped, SKIP_REASONS.EMPTY_BOARD);
});

test("a collapsed payload is refused", () => {
  const prior = snapshotFromPostings(Array.from({ length: 100 }, (_, i) => toNorm(gh(i))));
  const r = diffBoard({ org: "a", prior, current: [toNorm(gh(999))], target: TARGET });
  assert.equal(r.skipped, SKIP_REASONS.COLLAPSE);
  assert.equal(r.added.length, 0);
});

test("a normal-sized change is diffed and only the new id is added", () => {
  const prior = snapshotFromPostings([toNorm(gh(1)), toNorm(gh(2))]);
  const r = diffBoard({ org: "a", prior, current: [toNorm(gh(1)), toNorm(gh(2)), toNorm(gh(3))], target: TARGET });
  assert.equal(r.skipped, null);
  assert.deepEqual(r.added.map((p) => p.atsId), ["3"]);
});

test("a retitled posting keeping its id is not re-emitted", () => {
  const prior = snapshotFromPostings([toNorm(gh(1))]);
  const renamed = toNorm(gh(1, { title: "Program Manager, Renamed" }));
  const r = diffBoard({ org: "a", prior, current: [renamed], target: TARGET });
  assert.equal(r.added.length, 0);
});

test("an id already emitted is not emitted again even if the snapshot is lost", () => {
  const r = diffBoard({ org: "a", prior: {}, current: [toNorm(gh(7))], target: TARGET,
    seenIds: new Set(["a:7"]) });
  assert.equal(r.added.length, 0);
});

test("off-target titles are filtered, on-target kept", () => {
  assert.equal(matchesTarget({ title: "Software Engineer, Ops" }, TARGET), false);
  assert.equal(matchesTarget({ title: "Research Scientist" }, TARGET), false);
  assert.equal(matchesTarget({ title: "Operations Lead, Partners" }, TARGET), true);
  assert.equal(matchesTarget({ title: "Program Manager, Global Operations" }, TARGET), true);
});

test("end to end: seed run emits nothing, second run emits only the new role", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bw-"));
  await writeFile(path.join(root, "boards.json"), JSON.stringify({
    boards: [{ org: "acme", ats: "greenhouse", token: "acme" }], target: TARGET,
  }));

  let payload = { jobs: [gh(1), gh(2)] };
  const fetchImpl = async () => payload;

  const first = await run({ root, dryRun: false, fetchImpl });
  assert.equal(first.emitted.length, 0);
  assert.equal(first.results[0].skipped, SKIP_REASONS.SEED);

  payload = { jobs: [gh(1), gh(2), gh(3, { title: "Operations Lead" })] };
  const second = await run({ root, dryRun: false, fetchImpl });
  assert.equal(second.emitted.length, 1);
  assert.equal(second.emitted[0].atsId, "3");

  const urls = await readFile(path.join(root, "out", "new-urls.txt"), "utf8");
  assert.equal(urls.trim(), "https://boards.greenhouse.io/x/jobs/3");

  const third = await run({ root, dryRun: false, fetchImpl });
  assert.equal(third.emitted.length, 0);
});

test("a declined tracker requisition is suppressed and emits after the decline is removed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bw-declined-"));
  const declineMirrorPath = path.join(root, "tracker-mirror.json");
  await writeFile(path.join(root, "boards.json"), JSON.stringify({
    boards: [{ org: "invented", ats: "greenhouse", token: "invented" }], target: TARGET,
  }));

  let payload = { jobs: [gh(1)] };
  const fetchImpl = async () => payload;
  await run({ root, dryRun: false, fetchImpl, declineMirrorPath });

  await writeFile(declineMirrorPath, JSON.stringify({ rows: [{
    interest: "Not Interested",
    applicationUrl: "https://boards.greenhouse.io/x/jobs/2?gh_src=tracker",
  }] }));
  payload = { jobs: [gh(1), gh(2)] };
  const declined = await run({ root, dryRun: false, fetchImpl, declineMirrorPath });
  assert.equal(declined.emitted.length, 0);
  assert.equal(declined.suppressedDeclines.length, 1);
  assert.equal(declined.suppressedDeclines[0].atsId, "2");

  const state = JSON.parse(await readFile(path.join(root, "state", "snapshot.json"), "utf8"));
  assert.deepEqual(Object.keys(state.boards.invented.postings), ["1"]);
  const emitted = JSON.parse(await readFile(path.join(root, "state", "emitted.json"), "utf8"));
  assert.deepEqual(emitted.ids, []);

  await writeFile(declineMirrorPath, JSON.stringify({ rows: [] }));
  const restored = await run({ root, dryRun: false, fetchImpl, declineMirrorPath });
  assert.deepEqual(restored.emitted.map((posting) => posting.atsId), ["2"]);
});

test("end to end: a board that fails mid-life keeps its prior snapshot intact", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bw-"));
  await writeFile(path.join(root, "boards.json"), JSON.stringify({
    boards: [{ org: "acme", ats: "greenhouse", token: "acme" }], target: TARGET,
  }));
  let payload = { jobs: [gh(1), gh(2)] };
  const ok = async () => payload;
  await run({ root, dryRun: false, fetchImpl: ok });

  const boom = async () => { throw new Error("HTTP 503"); };
  const failed = await run({ root, dryRun: false, fetchImpl: boom });
  assert.equal(failed.results[0].skipped, SKIP_REASONS.FETCH_FAILED);

  const state = JSON.parse(await readFile(path.join(root, "state", "snapshot.json"), "utf8"));
  assert.deepEqual(Object.keys(state.boards.acme.postings).sort(), ["1", "2"]);

  payload = { jobs: [gh(1), gh(2), gh(4, { title: "Senior Program Manager" })] };
  const recovered = await run({ root, dryRun: false, fetchImpl: ok });
  assert.deepEqual(recovered.emitted.map((p) => p.atsId), ["4"]);
});

test("overflow remains outside the snapshot and emits on the next run", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bw-overflow-"));
  await writeFile(path.join(root, "boards.json"), JSON.stringify({
    boards: [{ org: "invented", ats: "greenhouse", token: "invented" }], target: TARGET,
  }));

  let payload = { jobs: [gh(1)] };
  const fetchImpl = async () => payload;
  await run({ root, dryRun: false, fetchImpl });

  payload = { jobs: Array.from({ length: 31 }, (_, index) => gh(index + 1)) };
  const first = await run({ root, dryRun: false, fetchImpl });
  assert.equal(first.emitted.length, 25);
  assert.equal(first.overflow, 5);
  const firstState = JSON.parse(await readFile(path.join(root, "state", "snapshot.json"), "utf8"));
  assert.equal(Object.keys(firstState.boards.invented.postings).length, 26);

  const second = await run({ root, dryRun: false, fetchImpl });
  assert.equal(second.emitted.length, 5);
  assert.equal(second.overflow, 0);
  const third = await run({ root, dryRun: false, fetchImpl });
  assert.equal(third.emitted.length, 0);
});

test("the CLI entry point actually runs when invoked from a path containing a space", async () => {
  // Regression: the main-module guard compared import.meta.url (percent-encoded) against a
  // raw argv path, so `node board-watch.mjs` was a silent no-op under any directory with a space.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { cp } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workspace = await mkdtemp(path.join(tmpdir(), "bw-workspace-"));
  const root = path.join(workspace, "bw space");
  await mkdir(root);
  const script = path.join(root, "board-watch.mjs");
  await cp(path.join(here, "board-watch.mjs"), script);
  await cp(path.join(here, "lib"), path.join(root, "lib"), { recursive: true });
  await cp(path.join(here, "..", "scripts", "requisition-key.mjs"), path.join(workspace, "scripts", "requisition-key.mjs"), { recursive: true });
  await cp(path.join(here, "..", "capture", "lib", "ats-api.mjs"), path.join(workspace, "capture", "lib", "ats-api.mjs"), { recursive: true });
  await writeFile(path.join(root, "boards.json"), JSON.stringify({ boards: [], target: TARGET }));
  const { stdout } = await promisify(execFile)(process.execPath, [script, "--dry-run"], { cwd: root });
  assert.match(stdout, /emitted 0 url\(s\)/);
});
