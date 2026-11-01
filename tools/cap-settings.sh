#!/bin/zsh
# Captures a Settings pane in light and dark: tools/cap-settings.sh <id> <pane number 1-7 (General … About)>
set -e
cd "${0:A:h}/.."
source tools/orca.zsh
id=$1; pane=$2
S=$(orca computer list-windows --app pid:$ECHOLOT_PID --json | jq -r '.result.windows[] | select(.title=="Echolot Settings") | .id' | head -1)
[[ -n $S ]] || { hk CmdOrCtrl+, >/dev/null; sleep 1.5; S=$(orca computer list-windows --app pid:$ECHOLOT_PID --json | jq -r '.result.windows[] | select(.title=="Echolot Settings") | .id' | head -1); }
pane_button() { axt $S | sed -n '/scroll area/,/text /p' | grep -E "^\s+[0-9]+ button" | sed -n "${1}p" | awk '{print $1}'; }
for mode in light dark; do
  clk $(pane_button 1) $S >/dev/null; sleep 0.8
  clk $(axt $S | grep -E "radio button ${(C)mode}," | head -1 | awk '{print $1}') $S >/dev/null; sleep 1
  clk $(pane_button $pane) $S >/dev/null; sleep 1.2
  src=$(orca computer get-app-state --app pid:$ECHOLOT_PID --window-id $S --json | jq -r '.result.screenshot.path')
  cp "$src" ".work/captures/$id-$mode.png"
  echo ".work/captures/$id-$mode.png"
done
