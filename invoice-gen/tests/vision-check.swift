// Independent Code 39 reader on macOS. No app or browser automation.
// swift -module-cache-path /tmp/invoice-swift-cache vision-check.swift /tmp/.../manifest.json
import Foundation
import Vision
import ImageIO

struct Fixture: Decodable { let file: String; let expected: String }
let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
var failures = 0
for fixture in fixtures {
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.code39]
    // Keep the test on the CPU so it also works in restricted headless sessions.
    request.usesCPUOnly = true
    let handler = VNImageRequestHandler(url: URL(fileURLWithPath: fixture.file), options: [:])
    do {
        try handler.perform([request])
        let values = (request.results ?? []).compactMap { $0.payloadStringValue }
        if values.contains(fixture.expected) { print("PASS \(fixture.expected)") }
        else { failures += 1; print("FAIL expected \(fixture.expected), got \(values)") }
    } catch { failures += 1; print("ERROR \(error)") }
}
if failures > 0 { exit(1) }
print("PASS: all \(fixtures.count) fixtures decoded independently by Apple Vision.")
