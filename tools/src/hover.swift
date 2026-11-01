// hover <x> <y> [seconds]: moves the pointer there in small steps and keeps it there, so SwiftUI hover fires.
import CoreGraphics
import Foundation
let x = Double(CommandLine.arguments[1])!, y = Double(CommandLine.arguments[2])!
let hold = CommandLine.arguments.count > 3 ? Double(CommandLine.arguments[3])! : 0.5
let start = CGEvent(source: nil)?.location ?? CGPoint(x: x - 40, y: y - 40)
for i in 1...20 {
    let t = Double(i) / 20
    let p = CGPoint(x: start.x + (x - start.x) * t, y: start.y + (y - start.y) * t)
    CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(15_000)
}
Thread.sleep(forTimeInterval: hold)
