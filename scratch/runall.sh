#!/bin/bash
cd "$(dirname "$0")/.."
pass=0; fail=0; failed=""
for f in _verify/t_*.js; do
  out=$(node "$f" 2>&1)
  code=$?
  if [ $code -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); failed="$failed $f"; fi
done
echo "PASS_FILES=$pass FAIL_FILES=$fail"
echo "FAILED:$failed"
