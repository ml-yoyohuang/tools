// Run from invoice-gen: swift tools/generate-moire-thumbs.swift
// Mirrors the fixed t=8 concentric-ring frame in artwork-renderer.js at thumbnail size.
import AppKit
import CoreGraphics
import Foundation

let width = 301, height = 480
let w = 1000.0, h = Double(height) * 1000 / Double(width)
let palettes = [("dfff00", "2446ff"), ("6940df", "dfff00"), ("fffefd", "f36b16")]
let spacings = [28.0, 32.0, 36.0]
let pans = [(16.0, -6.0), (20.0, -10.0), (24.0, -14.0)]
let centers = [(0.57, 0.48), (0.59, 0.46), (0.54, 0.50)]
let relative = [(0.0, 0.0), (8.0, -6.0), (-7.0, 6.0)]
let names = ["original", "alternate-1", "alternate-2"]
func color(_ hex: String) -> CGColor {
    let n = Int(hex, radix: 16)!
    return CGColor(srgbRed: CGFloat((n >> 16) & 255) / 255,
                   green: CGFloat((n >> 8) & 255) / 255,
                   blue: CGFloat(n & 255) / 255, alpha: 1)
}
for v in 0..<3 {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                               isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    let graphics = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    let c = graphics.cgContext
    c.translateBy(x: 0, y: CGFloat(height))
    c.scaleBy(x: CGFloat(width) / CGFloat(w), y: -CGFloat(height) / CGFloat(h))
    let background = color(palettes[v].0), ink = color(palettes[v].1)
    let x = w * (centers[v].0 + pans[v].0 / 100)
    let y = h * (centers[v].1 + pans[v].1 / 100)
    let radius = h * 0.70, spacing = spacings[v]
    c.setFillColor(background); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
    c.setStrokeColor(ink); c.setLineWidth(spacing * 0.28)
    func rings(_ cx: Double, _ cy: Double, _ r: Double, _ gap: Double) {
        c.saveGState()
        c.addEllipse(in: CGRect(x: cx-r, y: cy-r, width: 2*r, height: 2*r)); c.clip(); c.beginPath()
        var a = gap
        while a < r * 2.5 {
            c.addEllipse(in: CGRect(x: cx-a, y: cy-a, width: 2*a, height: 2*a))
            a += gap
        }
        c.strokePath(); c.restoreGState()
    }
    c.saveGState(); c.setAlpha(0.9)
    rings(x, y, radius, spacing)
    c.beginPath(); c.addEllipse(in: CGRect(x: x-radius, y: y-radius, width: 2*radius, height: 2*radius)); c.clip()
    c.setAlpha(0.55)
    rings(x + 132 + sin(2 * Double.pi * 8 / 20)*22 + relative[v].0,
          y + cos(2 * Double.pi * 8 / 20)*14 + relative[v].1, radius*1.15, spacing*1.015)
    c.restoreGState()
    c.setFillColor(background); c.fillEllipse(in: CGRect(x: x-36, y: y-36, width: 72, height: 72))
    c.setFillColor(ink); c.fillEllipse(in: CGRect(x: x-4, y: y-4, width: 8, height: 8))
    graphics.flushGraphics(); NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!
        .write(to: URL(fileURLWithPath: "thumbs/moire-\(names[v]).jpg"))
}
