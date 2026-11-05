#!/bin/zsh
# Captures every scene in the languages, then crops them into public/shots/<lang>/:
#   tools/capture-all.sh de fr …        (a language that fails a scene goes on with the others; failures are listed)
cd "${0:A:h}/.."
for lang in "$@"; do
  bun tools/drive.ts $lang 2>&1 | tee ".work/capture-$lang.log" | grep -E "FAILED|failed:" 
  bun tools/shots.ts --lang $lang 2>&1 | tail -1
done
