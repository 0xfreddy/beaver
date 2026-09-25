import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift import-beaver-pfps.swift <input-directory> <output-directory>\n", stderr)
  exit(64)
}

let fileManager = FileManager.default
let inputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let inputFiles = try fileManager.contentsOfDirectory(
  at: inputDirectory,
  includingPropertiesForKeys: nil,
  options: [.skipsHiddenFiles]
).filter { $0.pathExtension.lowercased() == "png" }.sorted {
  $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending
}

guard inputFiles.count == 5 else {
  fputs("Expected exactly five PNG portraits, found \(inputFiles.count).\n", stderr)
  exit(65)
}

try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func render(_ image: NSImage, size: Int) throws -> Data {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    throw CocoaError(.fileWriteUnknown)
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .high

  let canvas = NSRect(x: 0, y: 0, width: size, height: size)
  NSColor.clear.setFill()
  canvas.fill()
  NSColor(calibratedWhite: 0.16, alpha: 1).setFill()
  NSBezierPath(ovalIn: canvas).fill()

  let sourceSize = image.size
  let scale = min(CGFloat(size) / sourceSize.width, CGFloat(size) / sourceSize.height)
  let fittedSize = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
  let destination = NSRect(
    x: (CGFloat(size) - fittedSize.width) / 2,
    y: (CGFloat(size) - fittedSize.height) / 2,
    width: fittedSize.width,
    height: fittedSize.height
  )
  image.draw(
    in: destination,
    from: .zero,
    operation: .sourceOver,
    fraction: 1,
    respectFlipped: true,
    hints: [.interpolation: NSImageInterpolation.high]
  )
  context.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()

  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    throw CocoaError(.fileWriteUnknown)
  }
  return data
}

let variants: [(suffix: String, size: Int)] = [
  ("", 384),
  ("-tab", 28),
  ("-tab@2x", 56),
  ("-tab@3x", 84),
]

for (index, inputFile) in inputFiles.enumerated() {
  guard let image = NSImage(contentsOf: inputFile) else {
    fputs("Could not open \(inputFile.path).\n", stderr)
    exit(66)
  }
  let baseName = String(format: "beaver-%02d", index + 1)
  for variant in variants {
    let outputFile = outputDirectory.appendingPathComponent("\(baseName)\(variant.suffix).png")
    try render(image, size: variant.size).write(to: outputFile, options: .atomic)
  }
}
