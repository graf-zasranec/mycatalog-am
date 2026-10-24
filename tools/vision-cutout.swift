// Cuts a product photo out of its background with Apple's Vision foreground mask - the engine
// behind "Remove Background" in Preview and Finder. Owner-approved on the Mac 2026-10-24; rembg
// and tools/cutout.py stay off-limits.
//
//   swiftc -O tools/vision-cutout.swift -o /tmp/vision-cutout
//   /tmp/vision-cutout photo.jpg out.png      then: python3 tools/place-cut.py <id>__<colour> out.png
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 3, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("usage: vision-cutout in out.png"); exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(cgImage: cg)
try h.perform([req])
guard let r = req.results?.first else { print("no subject found"); exit(2) }
let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: true)
let ci = CIImage(cvPixelBuffer: buf)
guard let out = CIContext().createCGImage(ci, from: ci.extent),
      let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(3) }
CGImageDestinationAddImage(dst, out, nil)
CGImageDestinationFinalize(dst)
print("ok \(out.width)x\(out.height) instances=\(r.allInstances.count)")
