#!/usr/bin/env bash
# Bundle size guard for the security-regression workflow.
#
# Env inputs:
#   BUNDLE_PATH       - path to the final zip bundle (required)
#   BUNDLE_NAME       - display name for messages (defaults to basename of path)
#   BUNDLE_MAX_BYTES  - hard cap in bytes (required, positive integer)
#   GITHUB_STEP_SUMMARY - optional; if set, guard status is appended there
#
# Exit codes:
#   0 - under budget (may still warn if over the 80% soft limit)
#   1 - hard limit exceeded (error emitted, ::error annotation printed)
#   2 - invalid inputs (missing path, unreadable file, non-integer max)
set -euo pipefail

fail() {
  echo "enforce-bundle-size: $*" >&2
  exit 2
}

: "${BUNDLE_PATH:?BUNDLE_PATH is required}"
: "${BUNDLE_MAX_BYTES:?BUNDLE_MAX_BYTES is required}"
BUNDLE_NAME="${BUNDLE_NAME:-$(basename "$BUNDLE_PATH")}"

[ -f "$BUNDLE_PATH" ] || fail "bundle not found at $BUNDLE_PATH"
printf '%s' "$BUNDLE_MAX_BYTES" | grep -Eq '^[1-9][0-9]*$' \
  || fail "BUNDLE_MAX_BYTES must be a positive integer, got '$BUNDLE_MAX_BYTES'"

size=$(stat -c%s "$BUNDLE_PATH" 2>/dev/null || wc -c <"$BUNDLE_PATH")
max="$BUNDLE_MAX_BYTES"
soft_limit=$((max * 80 / 100))
hsize=$(numfmt --to=iec --suffix=B "$size" 2>/dev/null || echo "${size}B")
hmax=$(numfmt  --to=iec --suffix=B "$max"  2>/dev/null || echo "${max}B")
hsoft=$(numfmt --to=iec --suffix=B "$soft_limit" 2>/dev/null || echo "${soft_limit}B")

summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"
{
  echo "### 📏 Bundle size guard"
  echo ""
  echo "- Bundle: \`$BUNDLE_NAME\`"
  echo "- Size:   **$hsize** ($size bytes)"
  echo "- Budget: $hmax ($max bytes)"
  echo "- Soft limit (80%): $hsoft ($soft_limit bytes)"
} >> "$summary_file"

if [ "$size" -gt "$max" ]; then
  over=$((size - max))
  hover=$(numfmt --to=iec --suffix=B "$over" 2>/dev/null || echo "${over}B")
  echo "- Status: ❌ **exceeded budget by $hover**" >> "$summary_file"
  echo "::error title=Bundle size budget exceeded::$BUNDLE_NAME is $hsize (limit $hmax, over by $hover). Inspect manifest.json truncation_summary and tighten log caps or drop artifacts."
  exit 1
elif [ "$size" -gt "$soft_limit" ]; then
  over=$((size - soft_limit))
  hover=$(numfmt --to=iec --suffix=B "$over" 2>/dev/null || echo "${over}B")
  echo "- Status: ⚠️ **within budget but over soft limit by $hover**" >> "$summary_file"
  echo "::warning title=Bundle size approaching budget::$BUNDLE_NAME is $hsize (soft limit $hsoft, over by $hover). Consider tightening log caps or dropping artifacts before the hard limit is reached."
else
  echo "- Status: ✅ within budget" >> "$summary_file"
fi
