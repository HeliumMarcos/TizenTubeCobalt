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
docs_tree="$(git rev-parse --verify HEAD:docs)"
test "$(git cat-file -t "$engine_tree")" = tree
test "$(git cat-file -t "$docs_tree")" = tree

# TubeRush keeps its public documentation at the outer repository root,
# while upstream Cobalt DEPS/.gitmodules refer to src/docs/website.
# Reattach docs/ to the temporary engine source root without duplicating
# Git objects or adding an eighth item to the GitHub homepage.
root_entries="$(mktemp)"
trap 'rm -f "$root_entries"' EXIT
git ls-tree "$engine_tree" > "$root_entries"
if ! grep -Eq '^[0-9]{6} tree [0-9a-f]{40}[[:space:]]+docs

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
test "$(git rev-parse HEAD^{tree})" = "$build_tree"
test "$(git rev-parse HEAD:docs)" = "$docs_tree"

printf 'TubeRush outer repository commit: %s\n' "$original_commit"
printf 'Cobalt upstream subtree: %s\n' "$engine_tree"
printf 'Cobalt CI build tree (including docs): %s\n' "$build_tree"
printf 'CI-only detached Cobalt commit: %s\n' "$engine_commit"
echo "Cobalt source paths restored for GN, gclient, and native Android build."
 "$root_entries"; then
  printf '040000 tree %s\tdocs\n' "$docs_tree" >> "$root_entries"
fi
build_tree="$(git mktree --missing < "$root_entries")"

engine_commit="$(git \
  -c user.name='TubeRush CI' \
  -c user.email='github-actions[bot]@users.noreply.github.com' \
  commit-tree "$build_tree" -m "CI-only Cobalt engine view of $original_commit")"

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
