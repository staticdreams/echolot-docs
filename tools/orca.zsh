# Helpers for setting up screenshot scenes in Echolot through Orca. source tools/orca.zsh
# Needs ECHOLOT_PID, ECHOLOT_WINDOW, ECHOLOT_SETTINGS.
axt() { orca computer get-app-state --app pid:$ECHOLOT_PID --window-id ${1:-$ECHOLOT_WINDOW} --no-screenshot --json | jq -r '.result.snapshot.treeText'; }
# idx <pattern> [window]: the first element whose line matches the pattern
idx() { axt $2 | grep -E -- "$1" | head -1 | awk '{print $1}'; }
clk() { orca computer click --app pid:$ECHOLOT_PID --window-id ${2:-$ECHOLOT_WINDOW} --element-index $1 --no-screenshot --json | jq -c '.result.action.verification.state // .error'; }
# tap <pattern>: click the first element matching the pattern
tap() { local i=$(idx "$1" $2); [[ -n $i ]] || { echo "not found: $1"; return 1; }; clk $i $2; }
xy() { orca computer click --app pid:$ECHOLOT_PID --window-id $ECHOLOT_WINDOW --x $1 --y $2 ${3:+--click-count $3} --no-screenshot --json | jq -c '.result.action.delivery // .error'; }
hk() { orca computer hotkey --app pid:$ECHOLOT_PID --window-id ${2:-$ECHOLOT_WINDOW} --key $1 --no-screenshot --json | jq -c '.result.action.delivery // .error'; }
key() { orca computer press-key --app pid:$ECHOLOT_PID --window-id ${2:-$ECHOLOT_WINDOW} --key $1 --no-screenshot --json | jq -c '.result.action.delivery // .error'; }
# look [width]: a preview of the window at 1320 px wide (1 px = 1 pt) in /tmp/look.png
look() { local p=$(orca computer get-app-state --app pid:$ECHOLOT_PID --window-id ${2:-$ECHOLOT_WINDOW} --json | jq -r '.result.screenshot.path'); sips -Z ${1:-1320} "$p" --out /tmp/look.png >/dev/null; echo /tmp/look.png; }
setv() { orca computer set-value --app pid:$ECHOLOT_PID --window-id ${3:-$ECHOLOT_WINDOW} --element-index $1 --value "$2" --no-screenshot --json | jq -c '.result.action.verification.state // .error'; }
# openreq <name>: opens a request through the sidebar's Search
openreq() { xy 240 31 >/dev/null; sleep 0.8; local i=$(idx "Placeholder: Search requests"); setv $i "$1" >/dev/null; sleep 0.9; key Return >/dev/null; sleep 1.2; }
# sendreq [seconds]: clicks Send and waits
sendreq() { xy ${SEND_X:-1226} 122 >/dev/null; sleep ${1:-2.5}; }
# popover <x> <y>: clicks there only when no popover window is open yet (a click on an open one closes it)
popover() { local n=$(orca computer list-windows --app pid:$ECHOLOT_PID --json | jq '[.result.windows[] | select(.title == "")] | length'); (( n == 0 )) && xy $1 $2 >/dev/null; return 0; }
act() { orca computer perform-secondary-action --app pid:$ECHOLOT_PID --window-id ${3:-$ECHOLOT_WINDOW} --element-index $1 --action $2 --no-screenshot --json | jq -c '.result.action.verification.state // .error.message'; }
# axmenu <pattern>: opens the menu (or context menu) of the first element matching the pattern
axmenu() { local i=$(idx "$1"); [[ -n $i ]] || { echo "not found: $1"; return 1; }; act $i AXShowMenu; }
# pick <menu item title>: chooses an item of the open menu
pick() { local i=$(idx "menu item $1"); [[ -n $i ]] || { echo "no menu item $1"; return 1; }; act $i AXPress; }
