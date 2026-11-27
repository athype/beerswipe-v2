"""Scan-code formats shared by the kiosk readers and the flow."""

import re
from enum import Enum

USER_CODE_LENGTH = 32
MAX_SCAN_LENGTH = 48

_USER_CODE_RE = re.compile(r"[0-9a-f]{32}")


class ScanKind(Enum):
    USER = "user"
    PRODUCT = "product"
    INVALID = "invalid"


def normalize_scan_code(code: str) -> str:
    return code.strip().lower()


def normalize_product_code(code: str) -> str:
    """Trim surrounding whitespace without lowercasing (Code128 is case-sensitive)."""
    return code.strip()


def is_scannable_payload(text: str) -> bool:
    """ASCII alphanumeric only, 1..MAX_SCAN_LENGTH characters."""
    return (
        0 < len(text) <= MAX_SCAN_LENGTH
        and text.isascii()
        and text.isalnum()
    )


def classify_scan(code: str) -> ScanKind:
    stripped = code.strip()
    if _USER_CODE_RE.fullmatch(stripped.lower()):
        return ScanKind.USER
    if is_scannable_payload(stripped):
        return ScanKind.PRODUCT
    return ScanKind.INVALID
