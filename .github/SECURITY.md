# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SonarLox, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email **security@sonarlox.org** with a description of the vulnerability.
3. We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Scope

SonarLox is a desktop application (Electron). Security concerns include:
- Electron context isolation and sandbox integrity
- IPC handler input validation
- Dependency supply chain (npm packages)
- File handling (audio, MIDI, SoundFont parsing)
