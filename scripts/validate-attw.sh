#!/usr/bin/env bash
set -euo pipefail

# Runs arethetypeswrong on all publishable packages in the monorepo.
# Uses lerna to discover packages (automatically excludes private packages).
#
# Uses --profile node16 which corresponds to TypeScript's "moduleResolution: node16".
# This is the correct profile for modern Node.js (16+) module resolution behavior.
# Despite the name, it's appropriate for Node.js 20+ projects.
#
# See: https://arethetypeswrong.github.io/

# Check for required dependencies
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

echo "Running attw on all packages..."
echo

# Get package list from lerna (--loglevel silent suppresses info messages)
pkg_list=$(npx lerna ls --json --loglevel silent) || { echo "Error: Failed to list packages with lerna"; exit 1; }

# Check for empty package list
if [ -z "$pkg_list" ] || [ "$pkg_list" = "[]" ]; then
  echo "Error: No packages found - is this a lerna monorepo?"
  exit 1
fi

pkg_count=$(echo "$pkg_list" | jq length)
echo "Found $pkg_count packages to validate"
echo

has_errors=0

while IFS= read -r pkg_dir; do
  pkg_name=$(jq -r '.name' "$pkg_dir/package.json")
  echo -e "\033[34m$pkg_name\033[0m"

  if ! npx attw --pack "$pkg_dir" --profile node16 --no-emoji; then
    has_errors=1
  fi
  echo
done < <(echo "$pkg_list" | jq -r '.[].location')

if [ $has_errors -eq 1 ]; then
  echo -e "\033[31mArethetypeswrong validation failed!\033[0m"
  echo "See output above for specific issues."
  echo "Documentation: https://arethetypeswrong.github.io/"
  exit 1
else
  echo -e "\033[32mAll packages passed attw validation.\033[0m"
fi
