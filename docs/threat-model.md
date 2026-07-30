# Threat model

| Threat | Mitigation |
|--------|------------|
| Credential leak in logs | Never log passwords; doctor redacts |
| Session theft | Sessions gitignored; filesystem local to worker |
| Alert spam | Daily dedupe key per supplier+SKU |
| Targeting real vendors in CI | Dummy portal only in public demos |

Scrapers are brittle by nature when HTML changes — documented limitation.
