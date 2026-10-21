const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = mkdtempSync(path.join(os.tmpdir(), "jobsearchos-guards-"));
const opportunity = path.join(root, "opportunities", "acme_role_2026-07-15");
mkdirSync(opportunity, { recursive: true });
mkdirSync(path.join(root, "landing"), { recursive: true });
mkdirSync(path.join(root, "data"), { recursive: true });
mkdirSync(path.join(root, "rubric"), { recursive: true });
writeFileSync(path.join(root, "data", "tracker-mirror.json"), "{\\\"rows\\\":[]}\\n");
// The two calibrated comp anchors, quoted as the live rubric writes them.
writeFileSync(path.join(root, "rubric", "fit-rubric.md"), "| Comp | Base >= $150k | Below the $100k base floor |\n");
writeFileSync(path.join(root, "rubric", "deal-breakers.md"), "1. **Comp floor:** base salary >= $100k, genuinely never-below.\n");

const MIRRORED_HOOKS = [
  "_common.sh",
  "grammar-lint.sh",
  "no-invented-metric.sh",
  "scribe-check.sh",
  "verdict-gate.sh",
];

// The Codex hook mirror is optional in this template; its tests skip when .codex/hooks is absent.
const NO_CODEX = !existsSync(path.join(__dirname, "..", ".codex", "hooks")) && "no .codex/hooks mirror in this copy";

function run(name, payload, mirror = false) {
  return spawnSync("bash", [
    path.join(__dirname, "..", mirror ? ".codex" : ".claude", "hooks", name),
  ], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ tool_input: payload }),
    encoding: "utf8",
  });
}

const logPath = path.join(root, ".claude", "metrics", "guard-hits.jsonl");

function lastHit() {
  const log = readFileSync(logPath, "utf8");
  return JSON.parse(log.trim().split("\n").at(-1));
}

// These hooks always exit 0 (warn-and-log), so exit status proves nothing.
// The only observable signal of a fire is a new line in the guard-hits log.
function hitCount() {
  try {
    return readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

test("no-invented-metric passes sourced metrics and logs unsourced metrics", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(path.join(opportunity, "jd.md"), "Compensation is $200K.\\n");
  writeFileSync(assessment, "## VERDICT: PURSUE\\nRole-fits-you: 8/10 | You-fit-role: 7/10 | Gate: RESOLVED-PASS\\n$200K stated.\\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  writeFileSync(assessment, "## VERDICT: PURSUE\\nRole-fits-you: 8/10 | You-fit-role: 7/10 | Gate: RESOLVED-PASS\\n$999K stated.\\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  assert.equal(lastHit().guard, "no-invented-metric");
});

// Regression: the guard read only jd.md + tracker-mirror.json, so an assessment citing the
// owner's calibrated comp anchors was flagged on every run. Reproduced live against a real
// production assessment file.
test("no-invented-metric resolves rubric comp anchors cited as thresholds", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(path.join(opportunity, "jd.md"), "Base $160,000-$200,000/yr\n");
  const before = hitCount();
  writeFileSync(assessment, "Comp strong (10): $160-200k base clears both the $100k floor and the $150k 9-10 anchor with room.\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  assert.equal(hitCount(), before);
});

// One production assessment writes "$150,000 anchor" where the rubric writes "$150k", so
// literal source-set membership is not enough; the anchor test normalizes magnitudes.
test("no-invented-metric resolves a rubric anchor written in long form", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(path.join(opportunity, "jd.md"), "Base $160,000-$200,000/yr\n");
  const before = hitCount();
  writeFileSync(assessment, "Clears the $100k floor but is only partly at the $150,000 anchor.\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  assert.equal(hitCount(), before);
});

// The trade the fix must not make: adding rubric/ to the source set outright would let an
// invented company-comp claim pass whenever it happened to match an anchor.
test("no-invented-metric still logs a company-comp claim matching a rubric anchor", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(path.join(opportunity, "jd.md"), "No compensation stated.\n");
  writeFileSync(assessment, "The role pays $150k.\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  assert.equal(lastHit().guard, "no-invented-metric");
  assert.match(lastHit().detail, /\$150/);
});

// The load-bearing case: an anchor citation and an invented claim on one line. The cue
// window stops at the next metric, so "floor" cannot vouch for the $150k that precedes it.
test("no-invented-metric separates an invented claim from an anchor citation on one line", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(path.join(opportunity, "jd.md"), "No compensation stated.\n");
  writeFileSync(assessment, "The role pays $150k, above the $100k floor.\n");
  assert.equal(run("no-invented-metric.sh", { file_path: assessment }).status, 0);
  assert.match(lastHit().detail, /\$150/);
  assert.doesNotMatch(lastHit().detail, /\$100/);
});

// The mirror contract was hand-checked; this makes a one-sided edit fail the suite.
test("shared guard hooks are byte-identical between .claude and .codex", { skip: NO_CODEX }, () => {
  for (const name of MIRRORED_HOOKS) {
    const claude = readFileSync(path.join(__dirname, "..", ".claude", "hooks", name));
    const codex = readFileSync(path.join(__dirname, "..", ".codex", "hooks", name));
    assert.ok(claude.equals(codex), `${name} differs between .claude/hooks and .codex/hooks`);
  }
});

test("scribe-check accepts a marker and logs a missing marker", () => {
  const jd = path.join(opportunity, "jd.md");
  writeFileSync(jd, "SCRIBE: literal extraction, no paraphrase\\nJob text\\n");
  assert.equal(run("scribe-check.sh", { file_path: jd }).status, 0);
  writeFileSync(jd, "Job text\\n");
  assert.equal(run("scribe-check.sh", { file_path: jd }).status, 0);
  assert.equal(lastHit().guard, "scribe-check");
});

test("grammar-lint accepts PRD grammar and logs drift", () => {
  const assessment = path.join(opportunity, "assessment.md");
  writeFileSync(assessment, "## VERDICT: EXPLORE\nRole-fits-you: 8/10 | You-fit-role: 7/10 | Gate: UNRESOLVED\n");
  const before = hitCount();
  run("grammar-lint.sh", { file_path: assessment });
  assert.equal(hitCount(), before, "a valid assessment banner must not fire");
  writeFileSync(assessment, "## VERDICT: MAYBE\nScores: 8\n");
  run("grammar-lint.sh", { file_path: assessment });
  assert.equal(hitCount(), before + 1, "a malformed banner must fire once");
  assert.equal(lastHit().guard, "grammar-lint");
});

const LEDGER_HEADER = "| Processed | Source file | Folder | Verdict | Note |\n|---|---|---|---|---|\n";
const LEDGER_ROW = "| 2026-07-15 09:30 | acme.pdf | acme_role_2026-07-15 | EXPLORE | resolve comp |\n";
const RUNS_HEADER = "| When | Trigger | Found | Processed | Verdicts | Generated |\n|---|---|---|---|---|---|\n";
const RUNS_ROW = "| 2026-07-15 07:41 | scheduled | found=2 | processed=2 | pursue=0 explore=1 pass=1 | generatedAt=2026-07-15T07:41:00Z |\n";

test("grammar-lint leaves a valid ledger append silent", () => {
  const ledger = path.join(root, "landing", "_ledger.md");
  writeFileSync(ledger, LEDGER_HEADER + LEDGER_ROW);
  const before = hitCount();
  run("grammar-lint.sh", { file_path: ledger });
  assert.equal(hitCount(), before, "a conforming ledger row must not fire");
});

test("grammar-lint fires on a malformed ledger row and names its line", () => {
  const ledger = path.join(root, "landing", "_ledger.md");
  writeFileSync(ledger, LEDGER_HEADER + LEDGER_ROW + "| garbage | not a date | x |\n");
  const before = hitCount();
  run("grammar-lint.sh", { file_path: ledger });
  assert.equal(hitCount(), before + 1, "a malformed ledger row must fire once");
  const hit = lastHit();
  assert.equal(hit.guard, "grammar-lint");
  assert.match(hit.detail, /\b4\b/, "the detail must name the offending line number (4)");
});

test("grammar-lint stays silent on a header + separator with no data rows", () => {
  const ledger = path.join(root, "landing", "_ledger.md");
  writeFileSync(ledger, LEDGER_HEADER);
  const before = hitCount();
  run("grammar-lint.sh", { file_path: ledger });
  assert.equal(hitCount(), before, "header + separator alone must not fire");
});

test("grammar-lint validates _runs.md rows the same way", () => {
  const runs = path.join(root, "landing", "_runs.md");
  writeFileSync(runs, RUNS_HEADER + RUNS_ROW);
  let before = hitCount();
  run("grammar-lint.sh", { file_path: runs });
  assert.equal(hitCount(), before, "a conforming run row must not fire");
  writeFileSync(runs, RUNS_HEADER + RUNS_ROW + "| 2026-07-15 07:41 | scheduled | found=oops |\n");
  before = hitCount();
  run("grammar-lint.sh", { file_path: runs });
  assert.equal(hitCount(), before + 1, "a malformed run row must fire once");
  assert.equal(lastHit().guard, "grammar-lint");
});

test("grammar-lint fires through the Codex mirror on a malformed ledger row", { skip: NO_CODEX }, () => {
  const ledger = path.join(root, "landing", "_ledger.md");
  writeFileSync(ledger, LEDGER_HEADER + "| garbage | not a date | x |\n");
  const before = hitCount();
  run("grammar-lint.sh", { file_path: ledger }, true);
  assert.equal(hitCount(), before + 1, "the mirror copy must fire once");
  assert.equal(lastHit().guard, "grammar-lint");
});

test("verdict-gate passes a confirmed gate and blocks an unconfirmed one in the Codex mirror", { skip: NO_CODEX }, () => {
  const assessment = path.join(opportunity, "assessment.md");
  const opportunityPath = "opportunities/acme_role_2026-07-15";
  writeFileSync(assessment, "## VERDICT: PURSUE\\nRole-fits-you: 8/10 | You-fit-role: 7/10 | Gate: RESOLVED-PASS\\nConfirmed: PURSUE by owner 2026-07-15\\n");
  assert.equal(run("verdict-gate.sh", { skill: "tailor-handoff", opportunity_path: opportunityPath }).status, 0);
  writeFileSync(assessment, "## VERDICT: PURSUE\\nRole-fits-you: 8/10 | You-fit-role: 7/10 | Gate: UNRESOLVED\\n");
  const blocked = run("verdict-gate.sh", { skill: "tailor-handoff", opportunity_path: opportunityPath }, true);
  assert.equal(blocked.status, 0);
  assert.match(blocked.stdout, /permissionDecision":"deny/);
  assert.equal(lastHit().guard, "verdict-gate");
});
