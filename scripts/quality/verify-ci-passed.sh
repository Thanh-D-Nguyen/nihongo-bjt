#!/usr/bin/env bash
# Release gate: refuse to deploy a commit unless the CI workflow concluded
# "success" for exactly that SHA on a push to main. Artifact identity is the
# immutable commit SHA, never a branch name.
# Usage (GitHub Actions): GH_TOKEN=... GITHUB_REPOSITORY=owner/repo scripts/quality/verify-ci-passed.sh <sha>
set -euo pipefail

sha="${1:?usage: verify-ci-passed.sh <commit-sha>}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
case "$sha" in
  *[!0-9a-f]* | "") echo "::error::not a full commit SHA: $sha" >&2; exit 2 ;;
esac
[ "${#sha}" -eq 40 ] || { echo "::error::not a full 40-character commit SHA: $sha" >&2; exit 2; }

count="$(gh api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$sha&event=push&branch=main&status=success&per_page=1" --jq '.total_count')"
case "$count" in
  '' | *[!0-9]*) echo "::error::unexpected response from the GitHub API: $count" >&2; exit 2 ;;
esac
if [ "$count" -lt 1 ]; then
  echo "::error::CI has not succeeded for $sha on a push to main; refusing to deploy" >&2
  exit 1
fi
echo "CI succeeded for $sha (push to main) — deploying exactly this commit."
