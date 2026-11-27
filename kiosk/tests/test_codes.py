"""Tests for the shared scan-code formats (src/scan/codes.py)."""

import pytest

from src.scan import (
    MAX_SCAN_LENGTH,
    USER_CODE_LENGTH,
    ScanKind,
    classify_scan,
    is_scannable_payload,
    normalize_product_code,
    normalize_scan_code,
)

SCAN_CODE = "a1b2c3d4e5f60718293a4b5c6d7e8f90"


# ---------------------------------------------------------------------------
# classify_scan
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "code",
    [
        SCAN_CODE,
        SCAN_CODE.upper(),
        "A1b2C3d4E5F60718293A4b5C6D7e8F90",  # mixed casing
        f"  {SCAN_CODE}  ",  # surrounding whitespace is normalized away
        f"\t{SCAN_CODE}\n",
    ],
)
def test_32_hex_is_a_user_code_in_any_casing(code: str) -> None:
    assert classify_scan(code) is ScanKind.USER


@pytest.mark.parametrize(
    "code",
    [
        "8710400000001",  # 13-digit EAN
        "  8710400000001  ",
        "AbC12345",  # Code128 mixed casing
        "0" * (USER_CODE_LENGTH - 1),  # 31 hex
        "0" * (USER_CODE_LENGTH + 1),  # 33 hex
        "g" * USER_CODE_LENGTH,  # 32 chars, not hex
        "a" * MAX_SCAN_LENGTH,  # 48-char alphanumeric
    ],
)
def test_non_user_alphanumeric_payload_is_a_product_barcode(code: str) -> None:
    assert classify_scan(code) is ScanKind.PRODUCT


@pytest.mark.parametrize(
    "code",
    [
        "",
        "   ",
        "a" * (MAX_SCAN_LENGTH + 1),  # over 48 chars
        "a1b2c3d4e5f60718293a4b5c6d7e8f9!",  # punctuation
        "snake!",
        "https://beerswipe.example/scan?x=1",
        "line one\nline two",
        "héllo",
    ],
)
def test_everything_else_is_invalid(code: str) -> None:
    assert classify_scan(code) is ScanKind.INVALID


# ---------------------------------------------------------------------------
# is_scannable_payload
# ---------------------------------------------------------------------------


def test_payload_length_boundaries() -> None:
    assert is_scannable_payload("a") is True
    assert is_scannable_payload("a" * MAX_SCAN_LENGTH) is True  # 48
    assert is_scannable_payload("a" * (MAX_SCAN_LENGTH + 1)) is False  # 49


def test_empty_payload_is_not_scannable() -> None:
    assert is_scannable_payload("") is False


@pytest.mark.parametrize(
    "text",
    [
        "a b",  # inner whitespace
        "a-b",
        "a/b",
        "https://beerswipe.example",
        "snake!",
        "a\nb",
        "héllo",  # non-ASCII letter
        "１２３",  # fullwidth digits
    ],
)
def test_non_alphanumeric_payloads_are_not_scannable(text: str) -> None:
    assert is_scannable_payload(text) is False


def test_alphanumeric_payloads_are_scannable() -> None:
    assert is_scannable_payload("ABC123") is True
    assert is_scannable_payload("a" * MAX_SCAN_LENGTH) is True


def test_a_48_char_payload_is_a_product_barcode() -> None:
    """Any 1..48 ASCII alphanumeric payload other than 32 hex is a product barcode."""
    payload = "a" * MAX_SCAN_LENGTH
    assert is_scannable_payload(payload) is True
    assert classify_scan(payload) is ScanKind.PRODUCT


# ---------------------------------------------------------------------------
# normalize_scan_code / normalize_product_code
# ---------------------------------------------------------------------------


def test_normalize_strips_and_lowercases() -> None:
    assert normalize_scan_code("  A1B2C3  ") == "a1b2c3"
    assert normalize_scan_code(SCAN_CODE.upper()) == SCAN_CODE


def test_normalize_product_code_strips_without_lowercasing() -> None:
    assert normalize_product_code("  AbC123  ") == "AbC123"
    assert normalize_product_code("\t8710400000001\n") == "8710400000001"
