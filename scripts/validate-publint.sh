#!/usr/bin/env bash
set -euo pipefail

# Runs publint on all publishable packages in the monorepo.
# Uses lerna to discover packages (automatically excludes private packages).

echo "Running publint on all packages..."
echo

has_errors=0

for pkg_dir in $(npx lerna ls --json 2>/dev/null | jq -r '.[].location'); do
  pkg_name=$(jq -r '.name' "$pkg_dir/package.json")
  echo -e "\033[34m$pkg_name\033[0m"

  if ! (cd "$pkg_dir" && npx publint --strict); then
    has_errors=1
  fi
  echo
done

if [ $has_errors -eq 1 ]; then
  echo -e "\033[31mPublint validation failed!\033[0m"
  exit 1
else
  echo -e "\033[32mAll packages passed publint validation.\033[0m"
fi
