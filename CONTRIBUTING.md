# Contributing to NodeRunner

NodeRunner uses Python's standard library and plain HTML, CSS and JavaScript.
There is no build step. Read [AGENTS.md](AGENTS.md) for repository conventions
and [README.md](README.md) for setup and architecture.

## Development checks

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
node --check static/app.js
node --check static/registry.js
node --check static/settings.js
node --check static/icons.js
```

Tests simulate Nmap and process HTTP requests in memory. Starting the backend
performs a real network scan; use it only on a network you are authorized to scan.

## Changes and pull requests

- Keep fixes focused and explain the problem and resulting behaviour.
- Include relevant checks and screenshots for interface changes.
- Add meaningful regression coverage for logic and security fixes.
- Preserve device assignments, backups and credentials. Do not attach real LAN
  inventories, API tokens or exported registries to issues or pull requests.
- Update the README and release notes when behaviour changes. The displayed
  version and release history come from `APP_RELEASES` in `static/app.js`.

## Licensing

By submitting a contribution, you agree that it is licensed under AGPL-3.0-only, the same license as NodeRunner. Do not submit third-party code without compatible licensing and the required notices.
