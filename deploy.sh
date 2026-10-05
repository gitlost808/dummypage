#!/usr/bin/env bash
# infra-static-site-v1
# Build only into the empty staging directory supplied by the host publisher.
set -euo pipefail
[[ $# == 1 && -d $1 ]] || { echo 'Usage: deploy.sh EMPTY_STAGING_DIRECTORY' >&2; exit 2; }
destination=$(realpath -e -- "$1")
[[ -z $(find "$destination" -mindepth 1 -print -quit) ]] || {
  echo 'Staging directory must be empty' >&2
  exit 2
}
cd "$(dirname "$0")"
npm ci
npm run build -- --dist-dir "$destination"
test -s "$destination/index.html"
