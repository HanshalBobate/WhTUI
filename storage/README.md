# whtui storage

This directory contains runtime data for WHTUI:

- `browser-profile/` — Persistent Chromium user data (WhatsApp Web session)
- `logs/`            — Daily rotating application logs

## Important

**Do not delete `browser-profile/`** unless you want to re-scan the QR code.

The Chromium session stored here is what keeps you logged in across all restarts.
