#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/release.sh 0.1.0

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

npm test
npm version "$VERSION"
git push origin main --follow-tags

echo "Release $VERSION prepared."
echo "Next: create GitHub release or run npm publish."