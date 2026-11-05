// Renders proposed app icons the way the app draws them (docs/design/ICONS.md), so a new icon can be
// approved before it is wired in: real SF Symbols, 24pt semibold, on Build My Look's option tile, light and dark.
//
//   swift scripts/icon_sheet.swift out.png "Hot=thermometer.sun" "Warm=sun.max" "Cold=snowflake"
//
// Runs on any Mac with the Command Line Tools (no Xcode). A symbol this macOS doesn't have prints MISSING.
import AppKit

func hex(_ h: UInt32, _ a: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: a)
}

// Tokens from DESIGN.md (light / dark).
struct Theme { let background: NSColor; let fill: NSColor; let label: NSColor }
let themes = [
  Theme(background: hex(0xFFFFFF), fill: hex(0x787880, 0.12), label: hex(0x131315)),
  Theme(background: hex(0x000000), fill: hex(0x787880, 0.26), label: hex(0xF5F5F7)),
]

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2 else {
  print("usage: swift scripts/icon_sheet.swift out.png \"Label=sf.symbol\" ...")
  exit(1)
}
let out = args[0]
let items: [(String, String)] = args.dropFirst().map {
  let parts = $0.split(separator: "=", maxSplits: 1).map(String.init)
  return (parts[0], parts.count > 1 ? parts[1] : parts[0])
}

// Same geometry as OptionTile on a 393pt-wide iPhone: three per row, 8pt gaps, 20pt margins.
let scale: CGFloat = 3, width: CGFloat = 393, margin: CGFloat = 20, gap: CGFloat = 8
let tileW = (width - margin * 2 - gap * 2) / 3, tileH: CGFloat = 78
let rows = CGFloat((items.count + 2) / 3)
let blockH = margin * 2 + rows * tileH + (rows - 1) * gap
let height = blockH * CGFloat(themes.count)

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(width * scale), pixelsHigh: Int(height * scale),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: width, height: height)
NSGraphicsContext.saveGraphicsState()
let cg = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
cg.translateBy(x: 0, y: height)
cg.scaleBy(x: 1, y: -1)
NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)

var missing = false
for (t, theme) in themes.enumerated() {
  let top = CGFloat(t) * blockH
  theme.background.setFill()
  NSRect(x: 0, y: top, width: width, height: blockH).fill()
  for (i, (label, symbol)) in items.enumerated() {
    let tile = NSRect(x: margin + CGFloat(i % 3) * (tileW + gap), y: top + margin + CGFloat(i / 3) * (tileH + gap),
                      width: tileW, height: tileH)
    // The first tile is drawn selected (ink fill, inverted content) so both states are checked.
    let selected = i == 0
    (selected ? theme.label : theme.fill).setFill()
    NSBezierPath(roundedRect: tile, xRadius: 18, yRadius: 18).fill()
    let fg = selected ? theme.background : theme.label
    let config = NSImage.SymbolConfiguration(pointSize: 24, weight: .semibold)
      .applying(NSImage.SymbolConfiguration(paletteColors: [fg]))
    if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?.withSymbolConfiguration(config) {
      let s = image.size
      image.draw(in: NSRect(x: tile.midX - s.width / 2, y: tile.minY + 28 - s.height / 2, width: s.width, height: s.height),
                 from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    } else if t == 0 {
      print("MISSING \(symbol)")
      missing = true
    }
    let font = NSFont.systemFont(ofSize: 15, weight: .medium)
    let w = (label as NSString).size(withAttributes: [.font: font]).width
    (label as NSString).draw(at: NSPoint(x: tile.midX - w / 2, y: tile.minY + 49),
                             withAttributes: [.font: font, .foregroundColor: fg])
  }
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
exit(missing ? 2 : 0)
