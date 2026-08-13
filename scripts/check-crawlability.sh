#!/usr/bin/env bash
# Crawlability contract check.
#
# Curls /robots.txt and /sitemap.xml from a running server and asserts:
#   1. every <loc> in the sitemap returns HTTP 200
#   2. every sitemap URL is allowed by robots.txt
#   3. every known private route is blocked by robots.txt
#   4. robots.txt advertises the sitemap
#
# Usage: scripts/check-crawlability.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:8080
set -uo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:8080}}"
BASE_URL="${BASE_URL%/}"

# Routes that must never be crawlable. Keep in sync with
# PRIVATE_PREFIXES in src/lib/public-routes.ts.
PRIVATE_PATHS=(
  "/dashboard"
  "/schedule"
  "/workspaces/abc/calendar"
  "/checkout/start"
  "/invite/token123"
  "/api/public/payments/webhook"
)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "==> Base URL: $BASE_URL"

fetch() { # fetch <path> <outfile> -> prints status code
  curl -sS -o "$2" -w '%{http_code}' --max-time 30 "$BASE_URL$1"
}

robots_status="$(fetch /robots.txt "$tmp/robots.txt")"
sitemap_status="$(fetch /sitemap.xml "$tmp/sitemap.xml")"

echo "==> GET /robots.txt   -> $robots_status"
echo "==> GET /sitemap.xml  -> $sitemap_status"

failures=0
if [ "$robots_status" != "200" ]; then
  echo "FAIL: /robots.txt returned $robots_status (expected 200)"
  failures=$((failures + 1))
fi
if [ "$sitemap_status" != "200" ]; then
  echo "FAIL: /sitemap.xml returned $sitemap_status (expected 200)"
  failures=$((failures + 1))
fi
if [ "$failures" -ne 0 ]; then
  echo "::error::robots.txt / sitemap.xml are not both served"
  exit 1
fi

echo
echo "----- robots.txt -----"
cat "$tmp/robots.txt"
echo "----------------------"
echo

# Extract sitemap paths (strip scheme+host so we probe the server under test).
python3 - "$tmp/sitemap.xml" > "$tmp/paths.txt" <<'PY'
import re, sys
from urllib.parse import urlparse
xml = open(sys.argv[1], encoding="utf-8").read()
locs = re.findall(r"<loc>\s*(.*?)\s*</loc>", xml, re.S)
if not locs:
    sys.stderr.write("no <loc> entries found in sitemap.xml\n")
    sys.exit(1)
for loc in locs:
    p = urlparse(loc)
    print(p.path or "/")
PY
if [ $? -ne 0 ]; then
  echo "::error::could not parse sitemap.xml"
  exit 1
fi

# robots.txt matcher: longest-match wins, '$' anchors the end, '*' is a wildcard.
robots_allows() { # robots_allows <path> -> exit 0 if allowed
  python3 - "$tmp/robots.txt" "$1" <<'PY'
import re, sys
robots, path = open(sys.argv[1], encoding="utf-8").read(), sys.argv[2]
rules, active = [], False
for raw in robots.splitlines():
    line = raw.split("#", 1)[0].strip()
    if not line or ":" not in line:
        continue
    field, _, value = line.partition(":")
    field, value = field.strip().lower(), value.strip()
    if field == "user-agent":
        active = value == "*"
    elif field in ("allow", "disallow") and active and value:
        rules.append((field, value))

def matches(pattern, p):
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    rx = "".join(".*" if c == "*" else re.escape(c) for c in body)
    rx = "^" + rx + ("$" if anchored else "")
    return re.search(rx, p) is not None

best = None  # (specificity, allow?)
for field, pattern in rules:
    if matches(pattern, path):
        spec = len(pattern.rstrip("$"))
        allow = field == "allow"
        # Google tie-break: on equal length, Allow wins.
        if best is None or spec > best[0] or (spec == best[0] and allow):
            best = (spec, allow)
sys.exit(0 if (best is None or best[1]) else 1)
PY
}

x_robots() { # x_robots <path> -> prints the X-Robots-Tag header value (may be empty)
  curl -sSI --max-time 30 "$BASE_URL$1" 2>/dev/null \
    | tr -d '\r' \
    | awk -F': ' 'tolower($1)=="x-robots-tag" {print tolower($2)}' \
    | paste -sd, -
}

echo "==> Checking sitemap URLs are 200, robots-allowed and not noindexed"
while IFS= read -r path; do
  [ -n "$path" ] || continue
  code=""
  # Retry transient connection failures (server restart / cold SSR compile).
  for attempt in 1 2 3 4 5; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$BASE_URL$path" 2>/dev/null)"
    [ "$code" != "000" ] && break
    sleep 3
  done
  tag="$(x_robots "$path")"
  if [ "$code" != "200" ]; then
    echo "  FAIL $path -> HTTP $code (expected 200)"
    failures=$((failures + 1))
  elif ! robots_allows "$path"; then
    echo "  FAIL $path -> HTTP 200 but disallowed by robots.txt"
    failures=$((failures + 1))
  elif echo "$tag" | grep -qE 'noindex|none'; then
    echo "  FAIL $path -> allowlisted in robots.txt/sitemap.xml but served with X-Robots-Tag: $tag"
    failures=$((failures + 1))
  else
    echo "  ok   $path -> 200, robots-allowed, X-Robots-Tag: ${tag:-<none>}"
  fi
done < "$tmp/paths.txt"

echo
echo "==> Checking private routes are robots-blocked and X-Robots-Tag noindexed"
for path in "${PRIVATE_PATHS[@]}"; do
  tag="$(x_robots "$path")"
  if robots_allows "$path"; then
    echo "  FAIL $path -> allowed by robots.txt (must be disallowed)"
    failures=$((failures + 1))
  elif ! echo "$tag" | grep -qE 'noindex|none'; then
    echo "  FAIL $path -> disallowed by robots.txt but missing X-Robots-Tag noindex (got: ${tag:-<none>})"
    failures=$((failures + 1))
  else
    echo "  ok   $path -> disallowed, X-Robots-Tag: $tag"
  fi
done


echo
echo "==> Checking robots.txt advertises the sitemap"
if grep -qiE '^[[:space:]]*Sitemap:[[:space:]]*\S+/sitemap\.xml' "$tmp/robots.txt"; then
  echo "  ok   Sitemap directive present"
else
  echo "  FAIL robots.txt has no Sitemap: .../sitemap.xml directive"
  failures=$((failures + 1))
fi

echo
if [ "$failures" -ne 0 ]; then
  echo "::error::crawlability check failed with $failures problem(s)"
  exit 1
fi
echo "✓ crawlability check passed"
