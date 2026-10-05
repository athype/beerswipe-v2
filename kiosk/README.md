# Beerswipe Kiosk

Kivy touch kiosk for the Beerswipe bar. Targets a Raspberry Pi with a 7"
1024x600 touch panel; developed on Windows.

## Status

- Merged on `feature/BS-111-kiosk`: async API client + Pydantic models
  (`src/client`, `src/models`) and the scan-code reader layer
  (`src/scan`: protocol + keyboard-wedge driver for development).
- Scan-code backend merged (#143): `GET /api/v1/scan/lookup/:code`
  resolves a scanned code to its member. The kiosk client targets that
  route; calling it from the flow lands in PR B.
- This shell (PR A): the app boots with placeholder screens. Enter, Space or
  a tap walks idle -> greeting -> pick -> confirm -> result.
- Next: flow controller + real wiring (PR B), DESIGN.md visual pass (PR C).
  See issue #125 for the design and #111 for the full kiosk roadmap.

> Historical note: the 2026-09 pivot retired the planned NFC reader (PN532)
> in favour of a 2D scanner; `src/scan` replaces the old `src/nfc` layer.

## Run

Python >= 3.13 with uv. From this directory:

    uv sync
    uv run python main.py

Development opens a 1024x600 window. For a fullscreen run on the Pi:

    KIOSK_FULLSCREEN=1 uv run python main.py

## Scanner hardware

Honeywell Xenon XP 1950g, configured as a HID keyboard wedge on Windows:
scan "Add CR Suffix" so every scan ends with Enter, which is what the
keyboard-wedge reader expects. On Windows, install the Honeywell serial
driver *before* scanning any "USB Serial" or other configuration barcode —
configuring the scanner for serial without the driver in place can leave it
unable to scan configuration barcodes.

The Pi interface (HID vs USB serial) is still open — see issue #111. If the
scanner ends up on USB serial there, a serial reader lands alongside
`src/scan/keyboard.py` (and `pyserial` comes back with it).

For development without hardware, the keyboard-wedge reader
(`src/scan/keyboard.py`) feeds a typed code followed by Enter as a scan.

## Quality gates

    uv run mypy -p src.models -p src.client -p src.scan --strict
    uv run ruff check src/ main.py

`src/ui` is not part of the strict mypy run because kivy ships no type info.

## Layout

- `main.py`: entry point
- `src/models`: Pydantic mirrors of the shared TS contracts
- `src/client`: async httpx API client (single pooled connection)
- `src/scan`: scan-code reader layer (protocol + keyboard driver)
- `src/ui`: kivy App, ScreenManager and screens
