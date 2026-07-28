#!/usr/bin/env bash
# PostToolUse Write|Edit guard. jd.md must name its literal-extraction provenance.
set -u
. "$(dirname "$0")/_common.sh"

file=$(hook_file)
case "$file" in */opportunities/*/jd.md) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
grep -Eqi 'SCRIBE:[[:space:]]*literal( extraction)?([[:space:]]*,[[:space:]]*no paraphrase)?' "$file" && exit 0
log_hit "scribe-check" "${file#"$PROJECT_DIR/"}" "jd.md lacks the SCRIBE literal-extraction marker. Add: SCRIBE: literal extraction, no paraphrase."
exit 0
