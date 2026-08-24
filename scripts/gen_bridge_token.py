#!/usr/bin/env python3
"""Generate Bridge plaintext token + SHA256 (Windows / Linux / node9)."""

from __future__ import annotations

import hashlib
import secrets


def main() -> None:
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    print("=== Keep this PLAINTEXT on Windows / node9 only (do not commit) ===")
    print(f"GAOMEI_BRIDGE_TOKEN={token}")
    print()
    print("=== Put this HASH into cloud gaomei-web.env ===")
    print(f"GAOMEI_BRIDGE_TOKEN_SHA256={digest}")
    print()
    print("On cloud:")
    print("  1) edit /home/ubuntu/apps/gaomei_web/shared/gaomei-web.env")
    print("  2) sudo systemctl restart gaomei-web")
    print("  3) set the same GAOMEI_BRIDGE_TOKEN on Windows and node9")


if __name__ == "__main__":
    main()
