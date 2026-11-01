import AppKit
let pid = pid_t(CommandLine.arguments[1])!
let ok = NSRunningApplication(processIdentifier: pid)?.activate(options: [.activateAllWindows]) ?? false
print(ok ? "activated" : "failed")
