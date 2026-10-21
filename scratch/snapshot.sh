#!/bin/bash
OUT="$1"; mkdir -p "$OUT"; cd "$(dirname "$0")/.."
i=0
for f in _verify/t_*.js; do
  name=$(basename "$f" .js); i=$((i+1))
  timeout 40 node "$f" 2>&1 | sed -E 's/_verify\/shots\///g; s/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+/TS/g' > "$OUT/$name.txt"
  echo "[$i] $name rc=${PIPESTATUS[0]}" >> "$OUT/_progress.log"
done
node _verify/syntax.js >/dev/null 2>&1
for j in _verify/_inline_*.js; do node --check "$j" && echo "OK $j" || echo "SYNTAXFAIL $j"; done > "$OUT/_syntax.txt"
echo "SNAPSHOT_DONE $OUT" >> "$OUT/_progress.log"
