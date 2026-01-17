# Hair & Makeup Pro - App Icons

## Icon Generation

The app requires icons in various sizes for different platforms and use cases.

### Required Sizes

**Android/Chrome:**
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

**iOS/Safari:**
- apple-touch-icon.png (180x180)
- icon-120x120.png
- icon-152x152.png
- icon-167x167.png (iPad Pro)
- icon-180x180.png

**Favicon:**
- icon-16x16.png
- icon-32x32.png
- favicon.ico

### Generation from SVG

Use the included `icon.svg` as the source to generate PNG icons:

```bash
# Using ImageMagick
for size in 16 32 72 96 120 128 144 152 167 180 192 384 512; do
  convert icon.svg -resize ${size}x${size} icon-${size}x${size}.png
done

# Create apple-touch-icon
cp icon-180x180.png apple-touch-icon.png

# Create favicon
convert icon.svg -resize 32x32 favicon.ico
```

### Online Tools

You can also use online tools:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

Upload the icon.svg and download all required sizes.

## Splash Screens (iOS)

iOS requires splash screens for the add-to-homescreen experience:

- splash-640x1136.png (iPhone 5)
- splash-750x1334.png (iPhone 6/7/8)
- splash-1242x2208.png (iPhone 6/7/8 Plus)
- splash-1125x2436.png (iPhone X/XS)
- splash-1170x2532.png (iPhone 12/13/14)

## Badge Icon

For notifications:
- badge-72x72.png (monochrome, usually white on transparent)

## Shortcut Icons

For app shortcuts:
- shortcut-scenes.png (96x96)
- shortcut-timesheet.png (96x96)
