# NodeRunner branding

Artwork provided by the project owner for NodeRunner. The original files are
preserved byte for byte; they are not screenshots of a real network scan.

| File | Purpose |
| --- | --- |
| `originals/banner.jpeg` | Original banner, 2752×1536 |
| `originals/icon.jpeg` | Original NR icon, 2048×2048 |
| `originals/wallpaper.jpeg` | Original wallpaper, 1024×572 |
| `../../docs/images/noderunner-banner.webp` | README banner, 1280×714 |
| `../../docs/images/noderunner-social-preview.png` | GitHub social preview, 1280×640, below 1 MB |
| `../../docs/images/noderunner-wallpaper.webp` | Smaller downloadable wallpaper |
| `../../static/branding/icon-96.webp` | Application header icon |
| `../../static/branding/icon-180.png` | Touch icon |
| `../../static/branding/icon-192.png`, `icon-512.png` | Web app manifest icons |
| `../../static/branding/favicon.svg` | Simplified NR monogram for small browser icons |
| `../../static/branding/favicon-mask.svg` | Monochrome pinned-tab icon |

The social preview crops only the top and bottom of the banner, then scales
proportionally. The README banner preserves the full composition. Optimized
copies omit source metadata. The original JPEG icon has no transparent alpha;
the simplified SVG favicon has a rounded navy background.

The wallpaper is a download, not the map background, so host labels and the
Light theme retain their readability. No invented UI screenshot is included.

## License

The artwork is included under **AGPL-3.0-only**, the same license as NodeRunner;
see [LICENSE](../../LICENSE). Keep the license and attribution notices when
redistributing. No claim is made that the project name or artwork is a
registered trademark.

## GitHub social preview

Upload `docs/images/noderunner-social-preview.png` in **Repository Settings →
Social preview → Edit**. A commit containing the file does not activate the
preview by itself.

## Recreating optimized copies

These files were encoded with the `cwebp` and `dwebp` command-line utilities;
they are not application runtime dependencies. Resize the banner to width
1280 while retaining its aspect ratio. For the social preview, crop the
2752×1536 source to `x=0, y=80, width=2752, height=1376`, then resize to
1280×640. Keep originals unchanged and verify the preview remains below 1 MB.
