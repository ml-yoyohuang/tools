// Run from invoice-gen: swift tools/generate-social-assets.swift
// Generates raster sharing previews with two patterns from gallery.js.
import AppKit
import CryptoKit
import Foundation

let canvasWidth = 1200
let canvasHeight = 630
let blue = NSColor(srgbRed: 36/255, green: 70/255, blue: 1, alpha: 1)
let orange = NSColor(srgbRed: 1, green: 107/255, blue: 55/255, alpha: 1)
let ink = NSColor(srgbRed: 28/255, green: 37/255, blue: 35/255, alpha: 1)
let paper = NSColor(srgbRed: 248/255, green: 248/255, blue: 241/255, alpha: 1)

func rectangle(_ x: CGFloat, _ top: CGFloat, _ width: CGFloat, _ height: CGFloat) -> NSRect {
    NSRect(x: x, y: CGFloat(canvasHeight) - top - height, width: width, height: height)
}

func fill(_ rect: NSRect, color: NSColor, radius: CGFloat = 0) {
    color.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func text(_ value: String, x: CGFloat, top: CGFloat, size: CGFloat, color: NSColor, weight: NSFont.Weight = .regular) {
    let font = NSFont.systemFont(ofSize: size, weight: weight)
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byClipping
    (value as NSString).draw(at: NSPoint(x: x, y: CGFloat(canvasHeight) - top - size * 1.15),
                             withAttributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph])
}

func mark(x: CGFloat, y: CGFloat, size: CGFloat) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    context.saveGState()
    context.translateBy(x: x, y: y)
    context.scaleBy(x: size / 64, y: size / 64)
    fill(NSRect(x: 0, y: 0, width: 64, height: 64), color: blue, radius: 16)
    orange.setFill()
    NSBezierPath(ovalIn: NSRect(x: 15, y: 34, width: 16, height: 16)).fill()
    NSColor(srgbRed: 1, green: 253/255, blue: 242/255, alpha: 1).setStroke()
    let bars: [(CGFloat, CGFloat)] = [(13, 25), (20, 29), (26, 25), (33, 29), (39, 25), (46, 29), (51, 25)]
    let path = NSBezierPath()
    path.lineWidth = 4.5
    for (x, top) in bars {
        path.move(to: NSPoint(x: x, y: 12))
        path.line(to: NSPoint(x: x, y: top))
    }
    path.stroke()
    context.restoreGState()
}

func color(_ hex: String) -> NSColor {
    guard let value = Int(hex.dropFirst(), radix: 16) else { fatalError("Invalid color: \(hex)") }
    return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255,
                   green: CGFloat((value >> 8) & 255) / 255,
                   blue: CGFloat(value & 255) / 255, alpha: 1)
}

func pattern(_ name: String) -> NSImage {
    let width = 1200, height = 1600
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                       bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                       isPlanar: false, colorSpaceName: .deviceRGB,
                                       bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create pattern") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    if name == "dots-touching" {
        fill(NSRect(x: 0, y: 0, width: width, height: height), color: color("#42c65b"))
        color("#ff9ac8").setFill()
        for row in 0..<8 { for col in 0..<6 {
            NSBezierPath(ovalIn: NSRect(x: col * 200, y: row * 200, width: 200, height: 200)).fill()
        }}
    } else if name == "quarter-mosaic" {
        let colors = ["#fff6e4", "#313692", "#dafa5a", "#ec789f", "#7bd0ce"].map(color)
        let cells: [[(Int, Int, String)]] = [
            [(0,1,"tl"),(4,2,"tr"),(3,4,"bl"),(0,3,"br"),(3,1,"tl"),(1,4,"tr")],
            [(3,0,"br"),(0,4,"bl"),(1,0,"full"),(1,2,"tr"),(4,3,"tl"),(0,2,"full")],
            [(0,3,"bl"),(4,0,"tl"),(2,1,"tr"),(2,4,"br"),(0,3,"full"),(4,1,"bl")],
            [(2,4,"tl"),(1,4,"full"),(3,1,"br"),(0,4,"tr"),(1,3,"bl"),(3,0,"tl")],
            [(4,2,"br"),(0,1,"tr"),(3,2,"full"),(2,3,"bl"),(4,1,"tl"),(0,4,"br")],
            [(3,0,"tr"),(1,3,"bl"),(4,0,"full"),(0,2,"tl"),(3,4,"br"),(2,1,"tr")],
            [(0,4,"bl"),(2,1,"full"),(1,0,"tl"),(3,2,"tr"),(4,3,"bl"),(0,1,"br")],
            [(1,3,"br"),(4,0,"tr"),(0,2,"bl"),(2,4,"full"),(3,1,"tl"),(4,3,"br")]
        ]
        let corners: [String: (CGFloat, CGFloat)] = ["tl":(0,0),"tr":(200,0),"br":(200,200),"bl":(0,200),"full":(100,100)]
        for (row, items) in cells.enumerated() { for (col, cell) in items.enumerated() {
            let box = NSRect(x: col * 200, y: (7 - row) * 200, width: 200, height: 200)
            NSGraphicsContext.saveGraphicsState()
            NSBezierPath(rect: box).addClip()
            fill(box, color: colors[cell.0])
            let corner = corners[cell.2]!, radius: CGFloat = cell.2 == "full" ? 100 : 200
            let cx = box.minX + corner.0, cy = box.maxY - corner.1
            colors[cell.1].setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2)).fill()
            NSGraphicsContext.restoreGraphicsState()
        }}
    } else { fatalError("Unknown pattern: \(name)") }
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    let image = NSImage(size: NSSize(width: width, height: height))
    image.addRepresentation(bitmap)
    return image
}

func card(_ image: NSImage, x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat, angle: CGFloat = 0) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    context.saveGState()
    context.translateBy(x: x, y: CGFloat(canvasHeight) - top)
    context.rotate(by: angle * .pi / 180)
    let bounds = NSRect(x: -width/2, y: -height/2, width: width, height: height)
    let outer = NSBezierPath(roundedRect: bounds, xRadius: 18, yRadius: 18)
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.18)
    shadow.shadowOffset = NSSize(width: 0, height: -14)
    shadow.shadowBlurRadius = 27
    shadow.set()
    fill(bounds, color: .white, radius: 18)
    NSShadow().set()
    outer.addClip()
    image.draw(in: bounds, from: .zero, operation: .sourceOver, fraction: 1)

    let plate = NSRect(x: -width/2 + 17, y: -height/2 + 18, width: width - 34, height: 69)
    fill(plate, color: NSColor.white.withAlphaComponent(0.96), radius: 9)
    let barWidths: [CGFloat] = [3,2,5,2,3,5,2,4,2,5,3,2,4,5,2,3,2,5,4,2,3,5,2,4]
    let total = barWidths.reduce(0,+) + CGFloat(barWidths.count - 1) * 2
    let scale = min(1, (plate.width - 30) / total)
    var cursor = plate.midX - total * scale / 2
    for (index, barWidth) in barWidths.enumerated() {
        let barHeight: CGFloat = index % 7 == 0 ? 43 : 34
        fill(NSRect(x: cursor, y: plate.minY + 12, width: barWidth * scale, height: barHeight), color: ink)
        cursor += (barWidth + 2) * scale
    }
    context.restoreGState()
}

func png(_ name: String, width: Int, height: Int, draw: () -> Void) {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                        isPlanar: false, colorSpaceName: .deviceRGB,
                                        bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create bitmap") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    draw()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else { fatalError("Cannot create PNG") }
    try! data.write(to: URL(fileURLWithPath: name))
}

png("favicon-32.png", width: 32, height: 32) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    context.scaleBy(x: 0.5, y: 0.5)
    mark(x: 0, y: 0, size: 64)
}
png("apple-touch-icon.png", width: 180, height: 180) {
    mark(x: 0, y: 0, size: 180)
}

png("og-home.png", width: canvasWidth, height: canvasHeight) {
    fill(rectangle(0, 0, 1200, 630), color: paper)
    fill(rectangle(0, 0, 10, 630), color: orange)
    mark(x: 72, y: 630 - 69 - 46, size: 46)
    text("隨身一張", x: 133, top: 75, size: 30, color: ink, weight: .bold)
    text("POCKET CANVAS", x: 72, top: 184, size: 15, color: blue, weight: .semibold)
    text("把喜歡的，", x: 72, top: 225, size: 62, color: ink, weight: .bold)
    text("帶在身上。", x: 72, top: 301, size: 62, color: blue, weight: .bold)
    text("一張圖片，一組發票載具。", x: 74, top: 421, size: 22, color: ink)
    text("做成每天帶著走的卡面。", x: 74, top: 457, size: 22, color: ink)
    fill(rectangle(72, 535, 171, 42), color: NSColor(srgbRed: 226/255, green: 234/255, blue: 220/255, alpha: 1), radius: 21)
    text("手機桌布", x: 105, top: 545, size: 16, color: ink, weight: .medium)
    fill(rectangle(255, 535, 171, 42), color: NSColor(srgbRed: 1, green: 230/255, blue: 206/255, alpha: 1), radius: 21)
    text("悠遊卡卡面", x: 285, top: 545, size: 16, color: ink, weight: .medium)
    card(pattern("dots-touching"), x: 735, top: 340, width: 211, height: 336, angle: -12)
    card(pattern("quarter-mosaic"), x: 967, top: 308, width: 274, height: 436, angle: 8)
}

png("og-wizard.png", width: canvasWidth, height: canvasHeight) {
    fill(rectangle(0, 0, 1200, 630), color: .white)
    orange.setStroke()
    for row in -2...8 {
        let y = CGFloat(row) * 104 + 10
        let path = NSBezierPath()
        path.lineWidth = 44
        path.move(to: NSPoint(x: -210, y: y))
        for segment in 0..<8 {
            let start = CGFloat(segment) * 210 - 210
            let bend: CGFloat = segment.isMultiple(of: 2) ? 59 : -59
            path.curve(to: NSPoint(x: start + 210, y: y),
                       controlPoint1: NSPoint(x: start + 58, y: y + bend),
                       controlPoint2: NSPoint(x: start + 152, y: y + bend))
        }
        path.stroke()
    }
    fill(rectangle(218, 116, 764, 398), color: blue)
    text("隨身一張  /  簡易製作", x: 272, top: 163, size: 25, color: .white, weight: .medium)
    text("三步，做一張。", x: 267, top: 262, size: 78, color: .white, weight: .bold)
    text("你的發票載具卡面", x: 272, top: 384, size: 31, color: .white, weight: .medium)
}

func updateOGHash(page: String, image: String) {
    let bytes = try! Data(contentsOf: URL(fileURLWithPath: image))
    let hash = SHA256.hash(data: bytes).prefix(6).map { String(format: "%02x", $0) }.joined()
    let imageURL = "https://ml-yoyohuang.github.io/tools/invoice-gen/\(image)"
    let regex = try! NSRegularExpression(pattern: NSRegularExpression.escapedPattern(for: imageURL) + "(?:\\?v=[a-f0-9]+)?")
    let pageURL = URL(fileURLWithPath: page)
    let html = try! String(contentsOf: pageURL, encoding: .utf8)
    let range = NSRange(html.startIndex..<html.endIndex, in: html)
    let updated = regex.stringByReplacingMatches(in: html, range: range, withTemplate: imageURL + "?v=" + hash)
    precondition(regex.numberOfMatches(in: html, range: range) == 2, "Expected OG and Twitter image URLs in \(page)")
    try! updated.write(to: pageURL, atomically: true, encoding: .utf8)
}

updateOGHash(page: "index.html", image: "og-home.png")
updateOGHash(page: "wizard.html", image: "og-wizard.png")
