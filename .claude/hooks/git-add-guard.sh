#!/bin/bash
# PreToolUse Bash guard: blocks git add commands that force-add or that name
# protected career-content paths (PRD principle 8). Defense-in-depth above the
# git-native scripts/hooks/pre-commit guard, which remains the load-bearing layer.

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null) || exit 0

printf '%s' "$cmd" | grep -q 'git add' || exit 0

deny() {
  echo "git-add-guard: blocked. $1" >&2
  exit 2
}

if printf '%s' "$cmd" | grep -Eq 'git add[^|;&]*( -[A-Za-z]*f[A-Za-z]*( |$)| --force)'; then
  deny "Force-adding is not allowed; .gitignore is the career-content boundary (PRD principle 8)."
fi

# Anchor to a path start so scripts/test-data/ does not false-positive on data/.
if printf '%s' "$cmd" | grep -Eq "(^| |'|\"|=)(\./)?(opportunities|data)/"; then
  deny "Staging under opportunities/ or data/ is protected; career content never enters git history."
fi

if printf '%s' "$cmd" | grep -Eq "(^| |'|\"|=)(\./)?landing/"; then
  stripped=$(printf '%s' "$cmd" | sed -e 's|landing/_ledger\.md||g' -e 's|landing/_runs\.md||g' -e 's|landing/README\.md||g')
  if printf '%s' "$stripped" | grep -Eq "(^| |'|\"|=)(\./)?landing/"; then
    deny "Only landing/_ledger.md, landing/_runs.md, and landing/README.md may be staged from landing/."
  fi
fi

exit 0
