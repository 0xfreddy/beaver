import AppKit
import Foundation

let directories = CommandLine.arguments.dropFirst().map {
  URL(fileURLWithPath: $0, isDirectory: true)
}
guard !directories.isEmpty else {
  fputs("Usage: swift normalize-monochrome-frames.swift <frame-directory> [...]\n", stderr)
  exit(64)
}

let fileManager = FileManager.default
for directory in directories {
  let files = try fileManager.contentsOfDirectory(
    at: directory,
    includingPropertiesForKeys: nil,
    options: [.skipsHiddenFiles]
  ).filter { $0.pathExtension.lowercased() == "jpg" }.sorted {
    $0.lastPathComponent < $1.lastPathComponent
  }

  for file in files {
    guard let image = NSImage(contentsOf: file),
          let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
          let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: source.width,
            pixelsHigh: source.height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
          ),
          let context = NSGraphicsContext(bitmapImageRep: bitmap),
          let pixels = bitmap.bitmapData else {
      throw CocoaError(.fileReadCorruptFile)
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    context.cgContext.draw(
      source,
      in: CGRect(x: 0, y: 0, width: bitmap.pixelsWide, height: bitmap.pixelsHigh)
    )
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    for y in 0..<bitmap.pixelsHigh {
      let row = pixels.advanced(by: y * bitmap.bytesPerRow)
      for x in 0..<bitmap.pixelsWide {
        let offset = x * 4
        let luminance = max(Int(row[offset]), Int(row[offset + 1]), Int(row[offset + 2]))
        // Raster Lottie exports carry a charcoal video matte. Lift it to true black
        // while keeping the white line art at full intensity.
        let normalized = UInt8(clamping: max(0, (luminance - 48) * 255 / 207))
        row[offset] = normalized
        row[offset + 1] = normalized
        row[offset + 2] = normalized
        row[offset + 3] = 255
      }
    }

    guard let data = bitmap.representation(using: .png, properties: [:]) else {
      throw CocoaError(.fileWriteUnknown)
    }
    let destination = file.deletingPathExtension().appendingPathExtension("png")
    try data.write(to: destination, options: .atomic)
  }
}
