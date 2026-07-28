#!/usr/bin/env bash
# PostToolUse Write|Edit guard. Warns on frozen PRD 4.7 machine-line drift.
set -u
. "$(dirname "$0")/_common.sh"

file=$(hook_file)
case "$file" in */opportunities/*/assessment.md|*/landing/_ledger.md|*/landing/_runs.md) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
problem=""

# Prints "<line-number>:<row>" for each table row after the header separator.
# Anchoring on the separator means the header and separator are skipped
# structurally, while a malformed data row (still after the separator) never is.
table_data_rows() {
  awk '/^\|[[:space:]:|-]*\|[[:space:]]*$/ && !seen { seen = 1; next }
       seen && /^\|/ { print NR ":" $0 }' "$1"
}

# $1 = file, $2 = frozen PRD 4.7 ERE. Echoes a comma-joined list of the line
# numbers of data rows that fail the grammar (empty if all pass).
bad_rows() {
  local bad="" n row entry
  while IFS= read -r entry; do
    n=${entry%%:*}; row=${entry#*:}
    grep -Eq "$2" <<< "$row" || bad="$bad, $n"
  done < <(table_data_rows "$1")
  printf '%s' "${bad#, }"
}

# Reports drift for a markdown table file. $1 = file, $2 = row ERE, $3 = label.
# A file with pipe lines but no separator would leave every row unchecked, so
# that structural case is reported rather than passing silently.
check_table() {
  if ! grep -Eq '^\|[[:space:]:|-]*\|[[:space:]]*$' "$1"; then
    grep -Eq '^\|' "$1" && problem="$3 table has no header separator; no rows could be checked against PRD 4.7."
    return
  fi
  local bad; bad=$(bad_rows "$1" "$2")
  [ -n "$bad" ] && problem="$3 row(s) $bad do not match PRD 4.7."
}
case "$file" in
  */assessment.md)
    banner_line=$(grep -n -m1 '^## VERDICT:' "$file" || true)
    if [ -z "$banner_line" ]; then problem="Missing a PRD 4.7 verdict banner."
    else
      line_number=${banner_line%%:*}; banner=${banner_line#*:}; score=$(sed -n "$((line_number + 1))p" "$file")
      if ! grep -Eq '^## VERDICT: (PURSUE|EXPLORE|PASS)\b' <<< "$banner"; then problem="Verdict banner does not match PRD 4.7."
      elif ! grep -Eq '^Role-fits-you: [0-9]+/10 \| You-fit-role: [0-9]+/10 \| Gate: (RESOLVED-PASS|RESOLVED-FAIL|UNRESOLVED)$' <<< "$score"; then problem="Scores line directly below the verdict does not match PRD 4.7."; fi
    fi ;;
  */_ledger.md)
    check_table "$file" '^\| [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} \| [^|]+ \| [^|]+ \| (PURSUE|EXPLORE|PASS) \| [^|]* \|$' "Ledger" ;;
  */_runs.md)
    check_table "$file" '^\| [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} \| (scheduled|manual) \| found=[0-9]+ \| processed=[0-9]+ \| pursue=[0-9]+ explore=[0-9]+ pass=[0-9]+ \| generatedAt=[^|]+ \|$' "Run" ;;
esac
[ -z "$problem" ] && exit 0
log_hit "grammar-lint" "${file#"$PROJECT_DIR/"}" "$problem"
exit 0
