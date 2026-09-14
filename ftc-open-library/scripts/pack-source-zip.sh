#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
staging="$root/.tmp-source-pack"
bundle="$staging/ftc-open-library"
out_dir="$root/public/downloads"
out="$out_dir/ftc-open-library-source.zip"

mkdir -p "$out_dir"
rm -rf "$staging"
mkdir -p "$bundle"

rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'out/' \
  --exclude 'build/' \
  --exclude 'coverage/' \
  --exclude '.tmp-source-pack/' \
  --exclude 'public/downloads/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude '.DS_Store' \
  --exclude '**/.DS_Store' \
  --exclude 'supabase/.temp/' \
  --exclude 'supabase/.branches/' \
  --exclude '.vercel/' \
  "$root/" "$bundle/"

mkdir -p "$bundle/public/downloads"
rm -f "$out"
(
  cd "$staging"
  zip -r -q "$out" ftc-open-library
)

rm -rf "$staging"

ls -lh "$out"
echo "$out"
