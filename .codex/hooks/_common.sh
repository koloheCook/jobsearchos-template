#!/usr/bin/env bash
# Shared helper for jobSearchOS guard hooks. Source only after stdin is captured.
HOOK_INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$PWD}}"
METRICS_DIR="$PROJECT_DIR/.claude/metrics"

hook_file() {
  printf '%s' "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty'
}

log_hit() {
  mkdir -p "$METRICS_DIR" 2>/dev/null
  jq -cn --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg guard "$1" --arg file "$2" --arg detail "$3" \
    '{ts:$ts,guard:$guard,file:$file,detail:$detail}' >> "$METRICS_DIR/guard-hits.jsonl" 2>/dev/null
}
