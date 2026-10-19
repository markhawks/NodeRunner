# System installation layout

NodeRunner keeps its source-tree launch mode for development. The system
experimental Fedora 44 RPM installation layout is:

| Path | Contents |
| --- | --- |
| `/usr/bin/noderunner` | Launcher from `deploy/noderunner` (mode 0755) |
| `/usr/share/noderunner/` | `noderunner.py`, `NodeRunner.html`, `static/` (read-only application files) |
| `/var/lib/noderunner/` | Registry, existing API token and daily backups (private writable state) |
| `/etc/noderunner/` | `noderunner.conf`: packaged service listen address and port |

The backend serves the interface directly at `http://localhost:8000`; Apache
is optional. `deploy/apache-noderunner.conf` protects the separate development
checkout under `/var/www/html/NodeRunner`, not the system installation.

The launcher selects these paths explicitly. Direct Python execution keeps
the script directory as its default. Both launch modes support
`--data-dir PATH` and `--assets-dir PATH`, or the environment variables
`NODERUNNER_DATA_DIR` and `NODERUNNER_ASSETS_DIR`. Explicit command-line
options override environment values. `--html PATH` overrides the HTML file
without changing the static assets directory.

## Migrating existing data

1. Stop the existing backend before copying data; keep the original directory
   and a private backup until the new installation has been verified.
2. Provision `/var/lib/noderunner` for the account that will run the backend,
   with mode 0700. Copy `assignments.json`, existing daily backups and the
   existing token file (`hns_token.txt` or `noderunner_token.txt`) into it.
   Preserve private file permissions and set ownership to that account.
3. Install only the application files listed above under `/usr/share/noderunner`
   and the launcher under `/usr/bin`. Do not copy runtime data into `/usr/share`.
4. Start the new backend only when a real network scan is intended. Verify the
   registry, saved scan target, token authentication and persistence after restart.

Selecting an empty data directory starts with an empty registry and creates a
new token at startup. Migration is deliberately manual: the application never
copies, deletes or searches other installations for private data.

## Experimental Fedora 44 RPM (0.1.3)

Download `noderunner-0.1.3-0.1.test.fc44.noarch.rpm` from the GitHub v0.1.3
release. This is an unsigned test package, not an official Fedora package.
Check its SHA-256 against the release's `SHA256SUMS` before installation.

```bash
sudo dnf install ./noderunner-0.1.3-0.1.test.fc44.noarch.rpm
```

Installing creates the dedicated `noderunner` account and private data directory;
it does **not start the service or scan the network**. The existing development
checkout and its data are untouched. Perform the manual migration above before
starting if you want to reuse that registry and token, and do not run the old
backend simultaneously on port 8000.

When a real scan on your authorized network is intended:

```bash
sudo systemctl start noderunner.service
sudo systemctl status noderunner.service
sudo journalctl -u noderunner.service -b
```

Open `http://localhost:8000` and enter the API token from the service journal
in Settings → Connection. Keep that token private. The service runs as
`noderunner`, with **only `CAP_NET_RAW`** in its ambient/bounding capability sets.
`AF_PACKET` is permitted alongside the existing socket families so Nmap can
perform ARP discovery. The backend detects the effective capability and passes
`--privileged` to Nmap when running without root, enabling raw scans and MAC
reporting on the directly connected Ethernet/VLAN. `NoNewPrivileges`, private
state and the other service sandbox controls remain enabled.

The service and its Nmap child processes receive this limited network privilege;
they do not run as root. No file capabilities are added to the system Python or
Nmap executables, and no `CAP_NET_ADMIN` or `CAP_NET_BIND_SERVICE` is granted.
Plain source launches without root/capabilities retain TCP connect scanning.
MAC discovery cannot cross a router/NAT, and Wi-Fi client isolation, sleeping
clients or an incorrectly selected interface/network may still hide devices.
Vendor recognition also depends on Nmap's MAC-prefix database.

## Upgrade from the initial 0.1.2 RPM

Install the newer RPM, then apply the new unit and restart explicitly when a
real scan is intended:

```bash
sudo dnf upgrade ./noderunner-0.1.3-0.1.test.fc44.noarch.rpm
sudo systemctl daemon-reload
sudo systemctl restart noderunner.service
```

The update preserves the existing token and registry; no migration is performed.
A previous MAC-keyed registry from another instance will match devices once
MACs are discovered. Older `ip-...` records are not automatically merged into
MAC identities and trust is never transferred through hostname matching.

Inspect effective configuration if discovery still lacks MACs:

```bash
sudo systemctl cat noderunner.service
sudo systemctl show noderunner.service -p User -p AmbientCapabilities -p CapabilityBoundingSet -p RestrictAddressFamilies
sudo journalctl -u noderunner.service -b
```

Expect user `noderunner`, `CAP_NET_RAW` in the capability sets, and `AF_PACKET`
in the allowed families. Check for administrator drop-ins overriding these
settings and for SELinux denials; do not disable SELinux as a workaround.

`/etc/noderunner/noderunner.conf` is a systemd EnvironmentFile defining
`NODERUNNER_BIND` (default `127.0.0.1`) and `NODERUNNER_PORT` (default `8000`).
Restart the service after changes; every restart triggers a scan. The source
launch retains its existing default bind address `0.0.0.0`. To expose the
packaged service to the LAN, change the bind address explicitly and configure
access/firewall/TLS as appropriate. The package does not open firewall ports
or install a custom SELinux policy. The host's SELinux-enforcing behavior,
real scans and browser rendering still require manual testing.

To stop and remove the test package:

```bash
sudo systemctl stop noderunner.service
sudo dnf remove noderunner
```

Runtime registry/token/backup files are not packaged or removed by package
scripts. Keep a private backup before testing updates or removal. The service
is not automatically restarted during package upgrades; restart it explicitly
when you intend to apply an update and perform a scan.

## Rebuild from source

On Fedora 44, install `rpm-build`, `systemd-rpm-macros`, `python3` and `nodejs22`.
Use a real Git checkout (the original development directory may have an invalid
local `.git` reference). Source archives must come from Git, never by archiving
the runtime checkout wholesale:

```bash
builddir=$(mktemp -d /tmp/noderunner-rpmbuild.XXXXXX)
mkdir -p "$builddir/SOURCES"
git archive --format=tar.gz --prefix=noderunner-0.1.3/ \
  --output="$builddir/SOURCES/noderunner-0.1.3.tar.gz" v0.1.3
rpmbuild -ba --define "_topdir $builddir" deploy/noderunner.spec
```

The spec runs the Python and JavaScript suites without network scans. The
binary RPM is under `RPMS/noarch/`, and the source RPM under `SRPMS/`. The
initial package is not a claim of compatibility with later Fedora releases;
rebuild and test it separately on each target release.
