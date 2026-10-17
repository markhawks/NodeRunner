# System installation layout

NodeRunner keeps its source-tree launch mode for development. The system
installation layout intended for Fedora 44+ RPM packaging is:

| Path | Contents |
| --- | --- |
| `/usr/bin/noderunner` | Launcher from `deploy/noderunner` (mode 0755) |
| `/usr/share/noderunner/` | `noderunner.py`, `NodeRunner.html`, `static/` (read-only application files) |
| `/var/lib/noderunner/` | Registry, existing API token and daily backups (private writable state) |
| `/etc/noderunner/` | Reserved for future service configuration; not currently read by the app |

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

This change prepares paths and a launcher; it does not provide a built RPM,
an RPM spec or an enabled systemd service. The service account, Nmap privileges,
SELinux policy and package build/install/upgrade checks remain to be designed
and verified before distributing an RPM. Do not run the web service as root
merely to obtain MAC discovery.
