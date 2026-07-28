#!/usr/bin/env bash
# PostToolUse Write|Edit guard. Warns on metric-like values without a local source.
# jd.md + tracker-mirror.json count as sources anywhere. rubric/ comp anchors count only
# where the text cites one as a threshold: the anchor magnitude must match and a cue must
# follow within 32 chars, stopping at the next metric. So "clears the $100k floor"
# resolves while "pays $150k" still flags, even on the same line.
set -u
. "$(dirname "$0")/_common.sh"

file=$(hook_file)
case "$file" in */opportunities/*/assessment.md|*/opportunities/*/brief.md|*/opportunities/*/debrief.md) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
opportunity_dir=$(printf '%s' "$file" | sed -n 's#^\(.*\/opportunities\/[^/]*\)/.*$#\1#p')
sources="$(cat "$opportunity_dir/jd.md" "$PROJECT_DIR/data/tracker-mirror.json" 2>/dev/null || true)"
rubric="$(cat "$PROJECT_DIR/rubric/fit-rubric.md" "$PROJECT_DIR/rubric/deal-breakers.md" 2>/dev/null || true)"
missing="$(SOURCES="$sources" RUBRIC="$rubric" awk '
function norm(s,   m) {
  m = 1
  if (s ~ /[kK]$/)      { m = 1000;       s = substr(s, 1, length(s) - 1) }
  else if (s ~ /[mM]$/) { m = 1000000;    s = substr(s, 1, length(s) - 1) }
  else if (s ~ /[bB]$/) { m = 1000000000; s = substr(s, 1, length(s) - 1) }
  gsub(/[$,]/, "", s)
  return (s + 0) * m
}
BEGIN {
  TOKEN = "\\$[0-9][0-9,.]*[KMB]?|[0-9][0-9,.]*%|[0-9][0-9,.]*[KMB]"
  CUE = "floor|anchor|threshold|deal-breaker|dealbreaker|rubric|minimum"
  rest = ENVIRON["RUBRIC"]
  while (match(rest, /\$[0-9][0-9,.]*[kKmMbB]?/)) {
    anchor[norm(substr(rest, RSTART, RLENGTH))] = 1
    rest = substr(rest, RSTART + RLENGTH)
  }
}
{
  rest = $0
  while (match(rest, TOKEN)) {
    token = substr(rest, RSTART, RLENGTH)
    after = substr(rest, RSTART + RLENGTH)
    rest = after
    if (token ~ /^(19[0-9][0-9]|20[0-9][0-9])$/) continue
    if (index(ENVIRON["SOURCES"], token)) continue
    window = substr(after, 1, 32)
    if (match(window, TOKEN)) window = substr(window, 1, RSTART - 1)
    written = token
    if (substr(after, 1, 1) ~ /[kKmMbB]/) written = token substr(after, 1, 1)
    if (norm(written) in anchor && window ~ CUE) continue
    if (!(token in seen)) { seen[token] = 1; out = out (out ? ", " : "") token }
  }
}
END { if (out) print out }
' "$file")"
[ -z "$missing" ] && exit 0
log_hit "no-invented-metric" "${file#"$PROJECT_DIR/"}" "Untraceable metric-like values: $missing. Cite a source or use [METRIC NEEDED]."
exit 0
