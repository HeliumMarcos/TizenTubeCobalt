#!/usr/bin/env bash
# TubeRush seven-entry root migration. Uses Git trees, never rewrites main.
set -euo pipefail
repo='HeliumMarcos/TubeRush'
branch='refactor/seven-entry-root'
if [ "${GITHUB_REPOSITORY:-$repo}" != "$repo" ]; then
  echo 'Unexpected repository.' >&2; exit 2
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo 'Run in a TubeRush git clone.' >&2; exit 2
fi
old=$(git rev-parse HEAD)
if [ "${GITHUB_REF_NAME:-$branch}" != "$branch" ]; then
  echo "Expected branch $branch" >&2; exit 2
fi
if git ls-tree --name-only "$old" | grep -Fxq 'app'; then
  if ! git ls-tree --name-only "$old" | grep -Fxq 'cobalt'; then
    echo 'Root already migrated.'; exit 0
  fi
  echo 'Both app/ and cobalt/ exist: inspect manually.' >&2; exit 2
fi
if ! git ls-tree --name-only "$old" | grep -Fxq 'cobalt'; then
  echo 'cobalt/ missing; aborting.' >&2; exit 2
fi
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git ls-tree "$old" > "$work/original"
: > "$work/keep"; : > "$work/move"
while IFS=$'\t' read -r metadata filename; do
  case "$filename" in
    .github|docs|.gitattributes|.gitignore|AGENTS.md|README.md)
      printf '%s\t%s\n' "$metadata" "$filename" >> "$work/keep" ;;
    *) printf '%s\t%s\n' "$metadata" "$filename" >> "$work/move" ;;
  esac
done < "$work/original"
original_count=$(wc -l < "$work/original" | tr -d ' ')
kept_count=$(wc -l < "$work/keep" | tr -d ' ')
moved_count=$(wc -l < "$work/move" | tr -d ' ')
if [ "$kept_count" -ne 6 ] || [ "$original_count" -ne "$((kept_count+moved_count))" ]; then
  echo 'Unexpected root entry count.' >&2; exit 3
fi
app_tree=$(git mktree --missing < "$work/move")
printf '040000 tree %s\tapp\n' "$app_tree" >> "$work/keep"
root_tree=$(git mktree --missing < "$work/keep")
git ls-tree "$app_tree" > "$work/actual-move"
diff -u "$work/move" "$work/actual-move" || exit 3
git ls-tree --name-only "$root_tree" > "$work/actual-root"
cat > "$work/expected-root" <<'EXPECTED'
.gitattributes
.github
.gitignore
AGENTS.md
README.md
app
docs
EXPECTED
diff -u "$work/expected-root" "$work/actual-root" || exit 3
printf 'VERIFIED: %s original entries = %s kept + %s moved.\n' "$original_count" "$kept_count" "$moved_count"
cat "$work/actual-root"
if [ "${DRY_RUN:-0}" = 1 ]; then
  echo 'DRY_RUN=1: branch unchanged.'; exit 0
fi
commit=$(git \
  -c user.name="${GIT_AUTHOR_NAME:-TubeRush Migration}" \
  -c user.email="${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}" \
  commit-tree "$root_tree" -p "$old" \
  -m 'refactor: stage seven-entry repository root with Cobalt under app/')
echo "Prepared commit: $commit"
if [ "${PUSH_MIGRATION:-0}" = 1 ]; then
  git push origin "${commit}:refs/heads/${branch}"
  echo "Pushed migration to $branch"
else
  echo 'Commit local only; set PUSH_MIGRATION=1 to push.'
fi
echo 'IMPORTANT: Test .gitmodules, DEPS/gclient, GN paths and Android builds'
echo 'before merging the structural branch into main.'
