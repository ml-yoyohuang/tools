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
    if name == "grid-two-tone" {
        fill(NSRect(x: 0, y: 0, width: width, height: height), color: color("#17665b"))
        let lines = NSBezierPath()
        lines.lineWidth = 18
        for col in 0..<8 {
            let x = CGFloat(col * 180)
            lines.move(to: NSPoint(x: x, y: 0))
            lines.line(to: NSPoint(x: x, y: CGFloat(height)))
        }
        for row in 0..<10 {
            let y = CGFloat(row * 180)
            lines.move(to: NSPoint(x: 0, y: y))
            lines.line(to: NSPoint(x: CGFloat(width), y: y))
        }
        color("#f8df9b").setStroke()
        lines.stroke()
    } else if name == "squiggle-night" {
        fill(NSRect(x: 0, y: 0, width: width, height: height), color: color("#292054"))
        let segments: [[CGFloat]] = [
            [115,20,270,35,430,125], [610,240,770,20,950,90],
            [1150,155,1290,195,1240,300], [1180,420,1020,345,860,310],
            [670,260,550,380,660,450], [780,525,980,450,1080,550],
            [1210,680,990,750,840,670], [690,580,560,595,420,685],
            [300,765,110,625,0,760], [-90,870,80,965,230,850],
            [365,745,520,820,585,920], [665,1040,820,835,950,900],
            [1120,980,1260,910,1270,1030], [1280,1160,1070,1110,930,1075],
            [785,1030,680,1150,560,1130], [420,1110,335,1030,195,1135],
            [50,1240,-45,1270,-45,1375], [-40,1480,145,1430,280,1370],
            [410,1315,530,1425,660,1390], [800,1350,870,1290,1010,1385],
            [1140,1470,1210,1525,1300,1580]
        ]
        let line = NSBezierPath()
        line.move(to: NSPoint(x: -80, y: CGFloat(height - 90)))
        for s in segments {
            line.curve(to: NSPoint(x: s[4], y: CGFloat(height) - s[5]),
                       controlPoint1: NSPoint(x: s[0], y: CGFloat(height) - s[1]),
                       controlPoint2: NSPoint(x: s[2], y: CGFloat(height) - s[3]))
        }
        line.lineWidth = 34
        line.lineCapStyle = .round
        line.lineJoinStyle = .round
        color("#d9ff63").setStroke()
        line.stroke()
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
    card(pattern("grid-two-tone"), x: 735, top: 340, width: 211, height: 336, angle: -12)
    card(pattern("squiggle-night"), x: 967, top: 308, width: 274, height: 436, angle: 8)
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
