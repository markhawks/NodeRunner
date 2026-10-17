# Contributor context

NodeRunner is a local LAN inventory and topology UI backed by Python and Nmap, with a plain HTML/CSS/JavaScript frontend. No build step or application framework is used.

Read these maintained documents before continuing:

1. `AGENTS.md` — repository instructions, commands and data-preservation rules.
2. `SESSION_HANDOFF.md` — session context and the next work to resume.
3. `PROJECT_STATUS.md` — implemented changes, verification results and open tasks.
4. `README.md` — startup, API, configuration and troubleshooting.
5. `docs/SECURITY_REVIEW.md` — security fixes and verification limits.

Run regression checks without starting a network scan:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
```

The backend starts a real scan when launched. Preserve `assignments.json`, its backups and `noderunner_token.txt` (legacy `hns_token.txt`); never include their contents in shared output. Do not automatically transfer trust between MAC addresses based on hostname matches. `support.js` is not loaded by this application.

The prepared Apache configuration in `deploy/` must be installed separately; its presence in the repository does not mean the host is protected. Update the status and handoff documents after completing work.
