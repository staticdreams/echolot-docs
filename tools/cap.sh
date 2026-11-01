#!/bin/zsh
# Captures Echolot's workspace window through Orca into .work/captures/<id>-<appearance>.png. Popovers, menus and
# sheets of the window are in the capture.
#   tools/cap.sh <id>             light, then dark
#   tools/cap.sh <id> light|dark  one appearance
# Needs a Debug build (it listens for the appearance notification), ECHOLOT_PID and ECHOLOT_WINDOW, and
# .work/set-appearance (swiftc tools/src/set-appearance.swift -o .work/set-appearance). ECHOLOT_PREP, if set, is
# evaluated after each switch (with tools/orca.zsh loaded), to reopen a popover the switch closed.
set -e
cd "${0:A:h}/.."
source tools/orca.zsh
id=$1; shift
if (( $# )); then modes=("$@"); else modes=(light dark); fi
for mode in $modes; do
  .work/set-appearance $mode
  sleep 1
  if [[ -n $ECHOLOT_PREP ]]; then eval "$ECHOLOT_PREP" >/dev/null; sleep ${ECHOLOT_PREP_WAIT:-1.2}; fi
  target=${CAPTURE_WINDOW:-$ECHOLOT_WINDOW}
  shot=$(orca computer get-app-state --app pid:$ECHOLOT_PID --window-id $target --json | jq -r '.result.screenshot | "\(.path) \(.width)"')
  parts=(${=shot})
  win=$(orca computer list-windows --app pid:$ECHOLOT_PID --json | jq ".result.windows[] | select(.id == $target) | .width")
  cp "$parts[1]" ".work/captures/$id-$mode.png"
  # A popover or panel over the window makes Orca capture the region of all the app's windows, scaled down: record
  # that region (its scale and where the window sits in it) for tools/shots.ts.
  if (( parts[2] == win * 2 )); then
    rm -f ".work/captures/$id-$mode.json"
  else
    orca computer list-windows --app pid:$ECHOLOT_PID --json | jq --argjson w $parts[2] --argjson target $target '
      [.result.windows[]] as $all
      | ($all | map(.x) | min) as $x0 | ($all | map(.y) | min) as $y0
      | ($all | map(.x + .width) | max) as $x1 | ($all | map(.y + .height) | max) as $y1
      | ($all[] | select(.id == $target)) as $win
      | {scale: ($w / ($x1 - $x0)), x: ($win.x - $x0), y: ($win.y - $y0), width: ($x1 - $x0), height: ($y1 - $y0)}' > ".work/captures/$id-$mode.json"
  fi
  echo ".work/captures/$id-$mode.png"
  # ECHOLOT_POST, if set, runs after each capture (close a menu the prep opened, so the switch can run).
  if [[ -n $ECHOLOT_POST ]]; then eval "$ECHOLOT_POST" >/dev/null; sleep 0.6; fi
done
