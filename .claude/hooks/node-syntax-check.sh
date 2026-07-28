#!/bin/bash
# PostToolUse Write|Edit check: run node --check on any edited JS file under
# scripts/ and surface failures immediately (AGENTS.md verification requirement:
# node --check on every touched JS file before any merge request).

input=$(cat)
fp=$(printf '%s' "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null) || exit 0

case "$fp" in
  (*/scripts/*.mjs|*/scripts/*.cjs|*/scripts/*.js)
    [ -f "$fp" ] || exit 0
    if ! err=$(node --check "$fp" 2>&1); then
      {
        echo "node-syntax-check: node --check failed for $fp"
        printf '%s\n' "$err"
      } >&2
      exit 2
    fi
    ;;
esac

exit 0
