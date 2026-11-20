"""Scan-code formats shared by the kiosk readers and the flow."""

import re
from enum import Enum

USER_CODE_LENGTH = 32
MAX_SCAN_LENGTH = 48

_USER_CODE_RE = re.compile(r"[0-9a-f]{32}")


class ScanKind(Enum):
    USER = "user"
    INVALID = "invalid"


def normalize_scan_code(code: str) -> str:
    return code.strip().lower()


def is_scannable_payload(text: str) -> bool:
    """ASCII alphanumeric only, 1..MAX_SCAN_LENGTH characters."""
    return (
        0 < len(text) <= MAX_SCAN_LENGTH
        and text.isascii()
        and text.isalnum()
    )


def classify_scan(code: str) -> ScanKind:
    normalized = normalize_scan_code(code)
    return ScanKind.USER if _USER_CODE_RE.fullmatch(normalized) else ScanKind.INVALID
