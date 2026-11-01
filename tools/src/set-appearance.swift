import Foundation
DistributedNotificationCenter.default().postNotificationName(.init("com.staticdreams.Echolot.setAppearance"), object: CommandLine.arguments[1], userInfo: nil, deliverImmediately: true)
