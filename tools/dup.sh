#!/bin/zsh
# dup.sh <from-id> <to-id> …: reuses a capture for other shot ids (same scene).
cd "${0:A:h}/.."
from=$1; shift
for to in "$@"; do for m in light dark; do
  cp .work/captures/$from-$m.png .work/captures/$to-$m.png
  if [[ -f .work/captures/$from-$m.json ]]; then cp .work/captures/$from-$m.json .work/captures/$to-$m.json; else rm -f .work/captures/$to-$m.json; fi
done; done
