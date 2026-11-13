#!/usr/bin/env bash
# TubeRush CI: restore the original Cobalt/Chromium source layout from app/.
# No remote commits, destructive changes, or force-push are performed.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 PATH_TO_SOURCE_CHECKOUT" >&2
  exit 2
fi

src="$(cd "$1" && pwd)"
if [[ ! -d "$src/.git" ]]; then
  echo "Expected a Git checkout at $src" >&2
  exit 2
fi

cd "$src"
original_commit="$(git rev-parse HEAD)"

# The standalone Cobalt upgrade branch may still have the original layout.
if [[ -f .gn && -f DEPS && -f .gitmodules && -d cobalt ]]; then
  echo "Original Cobalt source layout detected; no transformation needed."
  exit 0
fi

if [[ ! -f app/.gn || ! -f app/DEPS || ! -f app/.gitmodules || ! -d app/cobalt ]]; then
  echo "Missing app/.gn, app/DEPS, app/.gitmodules or app/cobalt" >&2
  exit 3
fi

# app/ contains the upstream engine source; docs/ is kept at the outer root
# for the GitHub landing page. Cobalt DEPS still expects src/docs/website,
# so include docs/ again only in this detached CI engine view.
engine_tree="$(git rev-parse --verify HEAD:app)"
docs_tree="$(git rev-parse --verify HEAD:docs)"
test "$(git cat-file -t "$engine_tree")" = tree
test "$(git cat-file -t "$docs_tree")" = tree

root_entries="$(mktemp)"
trap 'rm -f "$root_entries"' EXIT
git ls-tree "$engine_tree" > "$root_entries"
if [[ -z "$(git ls-tree "$engine_tree" docs)" ]]; then
  printf '040000 tree %s\tdocs\n' "$docs_tree" >> "$root_entries"
fi
build_tree="$(git mktree --missing < "$root_entries")"

engine_commit="$(git \
  -c user.name='TubeRush CI' \
  -c user.email='github-actions[bot]@users.noreply.github.com' \
  commit-tree "$build_tree" \
  -m "CI-only Cobalt source view of $original_commit")"

# Normal GN paths now appear at the root of this checkout, exactly as
# Cobalt/depot_tools expects. This commits nothing to GitHub.
git checkout --detach --force "$engine_commit"

for path in .gn DEPS .gitmodules cobalt/BUILD.gn cobalt/build/gn.py \
  cobalt/version.h starboard/android/shared/BUILD.gn \
  third_party/blink/renderer/core/dom/document.cc docs; do
  if [[ ! -e "$path" ]]; then
    echo "Missing path after Cobalt layout restoration: $path" >&2
    exit 4
  fi
done

test ! -e app/.gn
test "$(git rev-parse 'HEAD^{tree}')" = "$build_tree"
test "$(git rev-parse HEAD:docs)" = "$docs_tree"

printf 'TubeRush outer commit: %s\n' "$original_commit"
printf 'Cobalt app source tree: %s\n' "$engine_tree"
printf 'CI build tree (includes docs): %s\n' "$build_tree"
printf 'Detached CI engine commit: %s\n' "$engine_commit"
echo "Restored Cobalt source layout for GN, gclient and the Android build."
