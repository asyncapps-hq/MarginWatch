# Security

Never commit `PORTAL_PASS`, SMTP secrets, or `.marginwatch/sessions/*.json`.

Worker stores Playwright `storageState` on disk only; DB keeps path/checksum metadata, not cookies.

Report issues privately via GitHub security advisories on KhyFee/MarginWatch.
