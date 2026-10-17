# NodeRunner

English | [Italiano](README.it.md)

**Version 0.1.1 · 17 October 2026 · Development release**

<img src="docs/images/noderunner-banner.webp" alt="NodeRunner — Local network scanner and room mapper" width="1280">

*Map your network. Know every node.*

NodeRunner is a local web application for discovering devices on your network, arranging them on a room map, and maintaining a personalized device registry. It combines a Python/Nmap backend with a plain HTML, CSS, and JavaScript interface. No frontend build or additional Python packages are required.

## Features

- **Room map:** drag devices into rooms and save their exact positions. Each room starts with a 4×4 grid and expands as needed; moving a device does not rearrange its neighbors.
- **Device registry:** a dedicated full-page view with search, filters, editable names, vendors, types, rooms, and Wi-Fi/Wired assignments. The gateway is included.
- **Sorting and grouping:** click column headings to sort. Sorting by Room or Connection creates separate tables for each group.
- **Scan status:** distinguish devices seen in the last successful scan, devices absent from it, and unverified devices. Absent devices are highlighted in pale yellow.
- **Exports:** download the current registry selection as Excel `.xlsx`, or use JSON export/import to back up and restore customizations.
- **Themes:** choose Light, Phosphor, or Ion from the shared toolbar. Your browser remembers the selection.
- **Shared controls:** switch between Map and Registry and run a scan from either view. Click the NodeRunner name or icon to read the versioned changelog.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Quick start

You need **Python 3.8+** and **Nmap** on your PATH. The declared minimum Python version has not been tested by the current suite; see [project status](PROJECT_STATUS.md) for the versions actually used. Node.js is only needed for development checks. Scapy is not required.

On Fedora, install the runtime dependencies:

```bash
sudo dnf install python3 nmap
```

Clone the repository and start the backend:

```bash
git clone https://github.com/markhawks/NodeRunner.git
cd NodeRunner
sudo python3 noderunner.py
```

Open **http://localhost:8000**. From another computer on your LAN, use the address of the computer running the backend.

1. Copy the API token printed in the terminal at startup.
2. Open **Settings → Connection → Backend token**.
3. Paste the token and select **SAVE TOKEN**. Repeat for each browser or device.
4. Select **RUN SCAN** whenever you want a fresh scan.

Starting the backend performs a scan. Keep the terminal open; **Ctrl+C** stops the server. Elevated privileges improve local MAC/vendor discovery. Only scan networks you are authorized to manage.

## Installation directory and migration

The standard installation path on this host is `/var/www/html/NodeRunner`. For a **new installation**, clone into a directory that does not already exist:

```bash
cd /var/www/html
sudo git clone https://github.com/markhawks/NodeRunner.git NodeRunner
cd /var/www/html/NodeRunner
sudo python3 noderunner.py
```

The existing installation has already been renamed to this path; do not clone over it or rerun an old migration script. When relocating another existing installation, stop its backend first, move the entire directory including runtime data and hidden files, update any Apache paths and service working directories, then restart from the new path with the same arguments. Keep `assignments.json`, its backups, and the existing token filenames unchanged. Resources and data are located relative to the Python script.

The backend URL remains `http://localhost:8000`. With Apache configured to serve this directory, the page URL is `http://localhost/NodeRunner/`. Update old bookmarks and reload with Ctrl+F5. After changing hostname or port, the browser may require the existing token to be entered again under Settings → Connection.

## Command-line options

```bash
sudo python3 noderunner.py --target 192.168.1.0/24
sudo python3 noderunner.py --no-ports
sudo python3 noderunner.py --top-ports 100
sudo python3 noderunner.py --port 8080
```

| Option | Purpose |
| --- | --- |
| `--target CIDR` | Scan an IPv4 network or a single IPv4 address. |
| `--no-ports` | Discover hosts without scanning their ports. |
| `--top-ports N` | Check the N most common TCP ports; default: 30. |
| `--port N` | Change the HTTP port; use the same port in your browser. |
| `--html PATH` | Serve a different HTML entry point; assets still come from the project's `static/` directory. |

Without `--target`, NodeRunner uses the network saved in Settings. If none is saved, it builds a `/24` network from the local IP address; this does not detect the interface's actual subnet mask. IPv6 scanning is not supported.

## Using the map and registry

### Map

Drag device cards to place them within rooms or outside them. Positions are saved without snapping or automatic neighbor alignment. Rooms start with 16 numbered cells and grow beyond that capacity, for example to 5×5. Scroll horizontally or vertically to reach larger maps. Wi-Fi and Wired panels use separate columns beside the map.

The gateway can also be assigned to a room and dragged. Room assignment is independent of Wi-Fi/Wired classification or the Gateway role.

### Registry

Choose **Registry** in the toolbar, or open `http://localhost:8000/#registry`. Choose **Map**, press Esc, or use browser navigation to return. The shared toolbar remains available in both views.

Search and the **Show** filter select which devices appear. Click a column heading to sort; click again to reverse the order. IP addresses and dates sort numerically, and blank values stay last in either direction. Sorting by **Room** or **Connection** groups devices into separate tables, including unassigned devices. Choosing another column restores a single table.

Use **Connection** to select Wi-Fi, Wired, or Unassigned. The **Vendor** menu supports common vendors, custom vendors from Settings, automatic detection, and **Other (type it in)**. Changes also appear on the map and in Excel exports. These connection assignments are manual, not detected by Nmap.

The gateway appears as **Gateway Router** unless renamed. Its detected hostname remains visible separately as **Detected** or **Detected hostname**. Reverse DNS can produce a name resembling a web address; NodeRunner is not opening that address. An inferred gateway remains **Not verified** until supported by scan results.

**Seen in scan** refers to the last successful scan, not continuous monitoring. **Not in scan** does not prove a device is powered off. Absent rows are yellow in all themes, including trusted devices; **Not verified** keeps neutral styling.

### Excel and JSON exports

Select **Export Excel (.xlsx)** to download the visible devices in the current filter and sort order. Grouped tables are exported to one worksheet in their displayed order. To export everything, select **All devices** and clear the search field.

The worksheet includes trust, scan status, alias, hostname, IP, MAC, vendor, type, room, connection, ports, last-seen time in UTC, and flags. It has a frozen header row and column filters. Values are text, including strings beginning with `=`; no formulas or external links are generated.

Excel is a report format. Use **Export JSON / Import JSON** for restorable registry backups. Exports do not include the API token. Excel export requires authentication and does not trigger a scan or save registry changes.

### Detection limits

Nmap supplies IP addresses, MAC addresses, hostnames, vendors, and open TCP ports among those tested. Device categories are estimates that you can correct manually.

- Rooms and Wi-Fi/Wired assignments do not reconstruct physical network links.
- **MARK BLOCKED** labels a device in the registry; it does not change a router or firewall.
- Automatic refresh is disabled (`AUTO_REFRESH_MS = 0`). Scan results remain in memory until a new scan or restart.
- Matching hostnames do not automatically transfer identity or trust to a new MAC address.
- Per-IP Internet traffic or data consumption is not currently measured.

## Project structure and local data

```text
noderunner.py                Python server, Nmap integration, API, persistence
NodeRunner.html             Main page; index.html is a compatibility link
static/app.js               State, validation, map, alerts, and saves
static/icons.js             Icon catalog and SVG sanitization
static/registry.js          Registry and import/export
static/settings.js          Settings and browser token handling
static/style.css            Interface styles
static/branding/            Optimized application icons and favicons
static/manifest.webmanifest Application name and icons
assets/branding/            Original artwork and asset documentation
tests/                      Python and JavaScript regression checks
deploy/                     Apache configuration template
docs/                       Security review and documentation images
```

`assignments.json` stores customizations, known devices, and configuration. `noderunner_token.txt` stores the API secret; older installations continue using their existing `hns_token.txt`. Runtime data, tokens, and backups are excluded from Git. Do not publish them with the source. Browsers also retain their token, theme, and a local state copy.

At startup, NodeRunner creates at most one daily backup named `assignments.json.bak.YYYY-MM-DD`, keeping the five most recent. Before manually restoring a file, stop the backend and preserve the current registry. JSON export provides a portable backup without the token.

### Existing HomeNetScanner installations

NodeRunner was previously named HomeNetScanner. The older `homenetscanner.py`, `HomeNetScanner.html`, and `deploy/apache-homenetscanner.conf` paths remain compatibility links. The local development installation uses `/var/www/html/NodeRunner` and is reachable through Apache at `http://localhost/NodeRunner/`; do not manually rename its data, backups, or tokens.

Browser preferences use `noderunner_*` keys with fallback to older `hns_*` values. The API also accepts the legacy `X-HNS-Token` header when `X-NodeRunner-Token` is absent.

After a backend update, stop the old process, restart `sudo python3 noderunner.py` with your usual arguments, and reload the browser with **Ctrl+F5**. Restarting performs a scan. Frontend-only changes generally need only a hard refresh.

## Development and contributing

There is no build step or package manager setup. Run the regression and syntax checks from the repository root:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
node --check static/app.js
node --check static/icons.js
node --check static/registry.js
node --check static/settings.js
```

The current suite contains **35 Python tests and 59 JavaScript checks**. It uses temporary files, mocked Nmap results, and in-memory HTTP requests without opening listening ports or scanning the network. If a local registry exists, compatibility checks read it without modifying it. These checks do not replace real-browser testing.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for contributor guidance, and [SECURITY.md](SECURITY.md) for vulnerability reporting. To resume an earlier development session, read [SESSION_HANDOFF.md](SESSION_HANDOFF.md), then [PROJECT_STATUS.md](PROJECT_STATUS.md). Those continuity documents are currently in Italian.

## API

All `/api/*` requests require **`X-NodeRunner-Token`**.

| Method and path | Purpose |
| --- | --- |
| `GET /api/devices` | Return the cached scan; start a scan if the cache is empty. |
| `GET /api/scan` | Force a new scan. |
| `GET/POST /api/assignments` | Read or save the registry and customizations. |
| `GET/POST /api/config` | Read or change the scan target. |
| `POST /api/export.xlsx` | Generate an Excel workbook from rows submitted by the browser. |

Nmap failures return HTTP 502. Invalid JSON is rejected, and request bodies are limited to 2 MiB. A corrupt registry is not silently replaced with an empty one.

Excel export accepts `{"rows": [["…", "…"]]}` with 14 text cells per row, up to 10,000 rows within the 2 MiB request limit. The workbook is generated in memory using Python's standard library.

## Network access and Apache

The backend serves the interface directly and listens on **all IPv4 interfaces**, not just localhost. It uses unencrypted HTTP. For access beyond a trusted LAN, configure protected access and TLS.

If Apache also serves the project directory, protect internal files there as well. With `AllowOverride None`, a `.htaccess` file is insufficient. A template is provided in [deploy/apache-noderunner.conf](deploy/apache-noderunner.conf); it is not installed automatically.

For the Fedora Apache layout:

```bash
sudo install -m 644 deploy/apache-noderunner.conf /etc/httpd/conf.d/noderunner.conf
sudo apachectl configtest && sudo systemctl reload httpd
```

Adapt the template's `/var/www/html/NodeRunner` path to your installation. Other web servers require equivalent rules. Private files must remain inaccessible over HTTP even when the Python backend is stopped.

Pages served by the backend use their own origin, including custom ports and reverse proxies. A page served directly by Apache looks for the API on port 8000 of the same host; a page opened through `file://` uses `http://localhost:8000`.

See [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) for fixes and review limits. The current security review is not an exhaustive audit.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `nmap not found` | Install Nmap and run `nmap --version`. |
| Missing token or HTTP 403 | Enter the correct backend token in Settings → Connection. |
| Connection failure | Check the backend terminal, address, port, and LAN access. |
| Missing MAC/vendor | Check privileges and device reachability on the local network segment. |
| HTTP 502 | Read the scan error and check the target and Nmap installation. |
| Save failure | Check permissions, token, and `assignments.json` integrity; preserve the file while troubleshooting. |

## Artwork

Original banner, NR icon, and wallpaper files are preserved in [assets/branding](assets/branding/README.md). The application loads optimized copies. Download the [original wallpaper](assets/branding/originals/wallpaper.jpeg) or its [WebP version](docs/images/noderunner-wallpaper.webp).

The [GitHub social preview](docs/images/noderunner-social-preview.png) is 1280×640 and under 1 MB. Set it through **Repository Settings → Social preview → Edit → Upload an image**; committing the file does not activate it automatically. Promotional illustrations are not screenshots of the application. No real network screenshots are included.

## License

SPDX-License-Identifier: AGPL-3.0-only

Copyright (C) 2026 NodeRunner contributors.

NodeRunner is licensed under the GNU Affero General Public License, version 3 only. See [LICENSE](LICENSE). Distributed derivative works must retain the applicable copyleft terms; modified versions offered over a network must make their corresponding source available as required by the license. Commercial use and redistribution are permitted. This software comes without warranty.

Source repository: [markhawks/NodeRunner](https://github.com/markhawks/NodeRunner).
