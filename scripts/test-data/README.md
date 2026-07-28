# WP-1 test data

These fixtures are invented. They contain no real third-party names, career data,
or job description text.

- `valid/` exercises grammar v1, a non-ASCII company name through `slug()`, and a
  complete web capture with an optional source snapshot. Every mirror row here carries a status from the PRD 6.B2
  live-row filter, because that is the only kind of row the mirror query can produce.
- `invalid/` exercises a malformed ledger date, assessment grammar drift, a broken
  mirror folder pointer, and a mirror row whose `applicationStatus` falls outside
  the 6.B2 filter (`emit-manifest` must name the row, exit 1, and leave the existing
  manifest untouched rather than publishing the bad row onward).
- `expected/` contains deterministic outputs for the valid tree.
- `notion-api/` replays invented official-API response shapes. The refresh test uses
  it to exercise parsing and the atomic local-write path without a network call or a
  secret, and confirms that the three optional tracker properties are reported when
  absent.

Tests live in `../scripts.test.cjs`. `../index.js` exists because `node --test
scripts/` resolves the directory as a CommonJS module rather than searching it for
test files; it loads every `*.test.cjs` sibling. Both stay CommonJS to keep the Node
floor low, per the PRD's long-stable-builtins constraint.
