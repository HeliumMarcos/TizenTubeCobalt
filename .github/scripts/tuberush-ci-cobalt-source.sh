#!/usr/bin/env bash
# CI-only: materialize app/ as a normal Cobalt/Chromium source root.
# The seven-entry TubeRush Git checkout remains unchanged on GitHub.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 PATH_TO_COBALT_SRC_CHECKOUT" >&2
  exit 2
fi

src="$(cd "$1" && pwd)"
if [[ ! -d "$src/.git" ]]; then
  echo "Expected a complete Git checkout at $src" >&2
  exit 2
fi

cd "$src"
original_commit="$(git rev-parse HEAD)"

if [[ -f .gn && -f DEPS && -f .gitmodules && -d cobalt ]]; then
  echo "Already using an original-layout Cobalt checkout; preserving it."
  echo "Cobalt source revision: $original_commit"
  exit 0
fi

if [[ ! -f app/.gn || ! -f app/DEPS || ! -f app/.gitmodules || ! -d app/cobalt ]]; then
  echo "Missing app/.gn, app/DEPS, app/.gitmodules or app/cobalt." >&2
  exit 3
fi

# No file-by-file copies, no tree rewriting on GitHub, no push.
# Git stores the complete original Cobalt source as the subtree HEAD:app.
engine_tree="$(git rev-parse --verify HEAD:app)"
test "$(git cat-file -t "$engine_tree")" = tree

engine_commit="$(git \
  -c user.name='TubeRush CI' \
  -c user.email='github-actions[bot]@users.noreply.github.com' \
  commit-tree "$engine_tree" -m "CI-only Cobalt engine view of $original_commit")"

# The detached checkout now has .gn, DEPS, .gitmodules, cobalt/ and third_party/
# at its actual root, so GN/gclient resolve all original relative source paths.
git checkout --detach --force "$engine_commit"

for path in .gn DEPS .gitmodules cobalt/BUILD.gn cobalt/build/gn.py cobalt/version.h \
  starboard/android/shared/BUILD.gn third_party/blink/renderer/core/dom/document.cc; do
  if [[ ! -f "$path" ]]; then
    echo "Missing Cobalt source after checkout: $path" >&2
    exit 4
  fi
done
test ! -e app/.gn
test "$(git rev-parse HEAD^{tree})" = "$engine_tree"

printf 'TubeRush outer repository commit: %s\n' "$original_commit"
printf 'Cobalt source tree: %s\n' "$engine_tree"
printf 'CI-only detached Cobalt commit: %s\n' "$engine_commit"
echo "Cobalt source paths restored for GN, gclient, and native Android build."
