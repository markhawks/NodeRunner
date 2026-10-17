# Changelog

Development releases, newest first. Earlier work is consolidated in v0.1.0.

## Unreleased

- Choose each room’s minimum grid in Settings: 2×2, 3×3 or 4×4; room sizes
  and the map canvas adapt to the selection and grow with extra occupants.
- Persist and validate room grid choices while preserving legacy 4×4 defaults
  and exact manually saved device coordinates.

- Frame the shared last-scan status with a clock icon and a 44 px toolbar box.

- Share one gear-icon Settings button in the Map/Registry toolbar, with the same
  44 px height as the view buttons.

- Separate writable state and application assets with `--data-dir` and
  `--assets-dir`, with environment defaults and source-tree compatibility.
- Prepare the system launcher and document `/usr/share/noderunner`,
  `/var/lib/noderunner` and manual migration for future Fedora RPM packaging.
- Preserve existing token names and backup behavior in the selected data directory.

## [0.1.1] — 2026-10-17

Official NodeRunner artwork and optimized application icons.

### Branding

- The NR artwork is now the application icon, with a simplified NR favicon.
- README banner, GitHub social preview and downloadable wallpaper.
- Original artwork is preserved separately from optimized web assets.

### Compatibility

- PNG app icons and an updated web app manifest.
- Only explicitly allowed branding files are served by the backend.

## [0.1.0] — 2026-10-17

First numbered NodeRunner development release.

### Interface

- Shared Map / Registry navigation, with Run scan always available.
- Light, Phosphor and Ion themes with previews and saved preferences.
- A visible version and release history, available from the NodeRunner name.

### Map and registry

- Room grids start at 16 places. Drag hosts freely without realigning their neighbours.
- Gateway room assignment and separate space for the Wi-Fi and Wired panels.
- Editable vendor, connection and room fields, sortable columns and grouped tables.
- Excel export and yellow highlighting for devices missing from the latest scan.

### Reliability

- Clear scan errors, protection against duplicate scans and safer data validation.
- Existing device assignments, tokens and browser preferences remain compatible.
