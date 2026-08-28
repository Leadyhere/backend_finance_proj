# Security Policy

Do not report suspected vulnerabilities in a public issue. Contact the repository owner privately and include reproduction steps without real customer or credential data.

## Secret handling

- Keep `.env` files out of Git and use deployment secret managers.
- Rotate any credential that was ever committed, even if the file was later deleted.
- Removing a file in a later commit does not remove it from Git history. History cleanup requires a coordinated rewrite and force-push after every exposed credential has been rotated.
- Never log JWTs, API keys, connection strings, or questionnaire payloads.
- Spending screenshots are held in memory and sent to the configured Grok model on xAI; they must not be written to local disk or object storage by default.
- Treat extracted merchant names and transaction previews as financial data. Keep previews short and never include account identifiers.

## Supported version

Security fixes target the latest commit on the `main` branch.
