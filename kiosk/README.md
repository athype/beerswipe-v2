# Beerswipe Kiosk

Kivy touch kiosk for the Beerswipe bar. Targets a Raspberry Pi with a 7"
1024x600 touch panel; developed on Windows.

## Status

- Merged on `feature/BS-111-kiosk`: async API client + Pydantic models
  (`src/client`, `src/models`), NFC reader abstraction with PN532 HSU driver
  and keyboard fallback (`src/nfc`), PN532 probe/debug scripts.
- This shell (PR A): the app boots with placeholder screens. Enter, Space or
  a tap walks idle -> greeting -> pick -> confirm -> result.
- Next: flow controller + real wiring (PR B), DESIGN.md visual pass (PR C).
  See issue #125 for the design and #111 for the full kiosk roadmap.

## Run

Python >= 3.13 with uv. From this directory:

    uv sync
    uv run python main.py

Development opens a 1024x600 window. For a fullscreen run on the Pi:

    KIOSK_FULLSCREEN=1 uv run python main.py

## NFC hardware

PN532 in HSU mode, wired to the GPIO bottom header (UART pins, TX/RX
crossed; the top header is I2C only). Bring-up from this directory:

    uv run python probe_pn532.py
    uv run python debug_pn532.py

Live hardware validation on the Pi is still outstanding (issue #111). For
development without hardware the keyboard reader (`src/nfc/keyboard.py`)
feeds a typed UID as a card tap.

## Quality gates

    uv run mypy -p src.models -p src.client -p src.nfc --strict
    uv run ruff check src/ main.py

`src/ui` is not part of the strict mypy run because kivy ships no type info.

## Layout

- `main.py`: entry point
- `src/models`: Pydantic mirrors of the shared TS contracts
- `src/client`: async httpx API client (single pooled connection)
- `src/nfc`: NFC reader abstraction and drivers
- `src/ui`: kivy App, ScreenManager and screens
