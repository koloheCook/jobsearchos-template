// Diff engine. Pure: no network, no filesystem. Every guard against a bad fetch lives here.

export const SKIP_REASONS = {
  FETCH_FAILED: "fetch_failed",
  EMPTY_BOARD: "empty_board",
  COLLAPSE: "collapse_guard",
  SEED: "seed_only",
};

// A board whose posting count collapses by more than this fraction is not diffed.
// A real board does not lose most of its postings overnight; a truncated or
// partially-served payload does.
export const COLLAPSE_THRESHOLD = 0.4;

export function matchesTarget(posting, target) {
  const title = posting.title.toLowerCase();
  if (target.excludeTitle?.some((term) => title.includes(term.toLowerCase()))) return false;
  const roleHit = target.roleTerms.some((term) => title.includes(term.toLowerCase()));
  if (!roleHit) return false;
  if (!target.domainTerms?.length) return true;
  return target.domainTerms.some((term) => title.includes(term.toLowerCase()));
}

// prior: { [atsId]: posting } or null/undefined when the board has never been seen.
// current: array of normalized postings, or null when the fetch failed.
export function diffBoard({ org, prior, current, error, target, seenIds }) {
  if (error || current === null) {
    return { org, skipped: SKIP_REASONS.FETCH_FAILED, detail: error ?? "no payload", added: [], counts: null };
  }
  if (current.length === 0) {
    return { org, skipped: SKIP_REASONS.EMPTY_BOARD, detail: "board returned zero postings", added: [], counts: null };
  }

  const priorIds = prior ? Object.keys(prior) : null;
  const counts = { prior: priorIds ? priorIds.length : null, current: current.length };

  if (priorIds === null) {
    return { org, skipped: SKIP_REASONS.SEED, detail: `seeded ${current.length} postings`, added: [], counts };
  }

  if (priorIds.length > 0 && current.length < priorIds.length * (1 - COLLAPSE_THRESHOLD)) {
    return {
      org,
      skipped: SKIP_REASONS.COLLAPSE,
      detail: `count fell from ${priorIds.length} to ${current.length}`,
      added: [],
      counts,
    };
  }

  const priorSet = new Set(priorIds);
  const added = current.filter((posting) => {
    if (priorSet.has(posting.atsId)) return false;
    if (seenIds?.has(`${org}:${posting.atsId}`)) return false;
    return matchesTarget(posting, target);
  });

  return { org, skipped: null, detail: null, added, counts };
}

export function snapshotFromPostings(postings) {
  const snapshot = {};
  for (const posting of postings) snapshot[posting.atsId] = posting;
  return snapshot;
}
