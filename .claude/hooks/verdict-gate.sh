#!/usr/bin/env bash
# PreToolUse Skill guard. Blocks tailoring-oriented skills without the required gate.
set -u
. "$(dirname "$0")/_common.sh"

skill=$(printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.skill // .tool_input.name // empty' | tr '[:upper:]' '[:lower:]')
case "$skill" in *tailor*|*resume*|*customiz*|*cover-letter*|*application*) ;; *) exit 0 ;; esac
context=$(printf '%s' "$HOOK_INPUT" | jq -r '[.tool_input.opportunity_path, .tool_input.path, .tool_input.prompt, .tool_input.args] | map(select(type == "string")) | join(" ")')
relative_dir=$(grep -oE 'opportunities/[A-Za-z0-9][A-Za-z0-9._-]*' <<< "$context" | head -1 || true)
if [ -z "$relative_dir" ] || [ ! -f "$PROJECT_DIR/$relative_dir/assessment.md" ]; then
  reason="Tailoring requires an opportunity path with an assessment.md file."
  log_hit "verdict-gate" "${relative_dir:-opportunities/(unknown)}" "$reason"
  jq -cn --arg reason "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
  exit 0
fi
assessment="$PROJECT_DIR/$relative_dir/assessment.md"
if grep -Eq '^Confirmed: PURSUE by owner [0-9]{4}-[0-9]{2}-[0-9]{2}$' "$assessment" && grep -Eq '^Role-fits-you: [0-9]+/10 \| You-fit-role: [0-9]+/10 \| Gate: RESOLVED-PASS$' "$assessment"; then exit 0; fi
reason="Tailoring is blocked until assessment.md has Confirmed: PURSUE by owner YYYY-MM-DD and Gate: RESOLVED-PASS."
log_hit "verdict-gate" "$relative_dir/assessment.md" "$reason"
jq -cn --arg reason "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
exit 0
