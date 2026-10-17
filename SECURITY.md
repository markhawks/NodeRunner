# Security

NodeRunner is a development release intended for a controlled LAN environment.
The API uses a shared token; it does not provide individual accounts or roles.
See [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) for implemented protections
and their verification limits.

Do not post API tokens, device assignments, backup files or real LAN inventory
exports in public issues. For a suspected vulnerability, use GitHub's private
vulnerability reporting if the repository has it enabled. Otherwise contact
the maintainer privately before publishing exploit details.

Keep changes to authentication, persistence, imported data and static-file
access covered by the regression suite.
