# Beerswipe Kiosk

Kivy touch kiosk for the Beerswipe bar. Targets a Raspberry Pi with a 7"
1024x600 touch panel; developed on Windows.

## Status

- Working scan-to-buy flow (PR B): scan a code, pick a drink and a
  quantity, confirm, and the sale is posted — the result screen shows the
  member's remaining credits and every screen times back to idle. The
  state machine, timeouts and error handling live in `src/flow`, which is
  kivy-free so the flow is covered headless by `tests/test_flow.py`.
- Merged on `feature/BS-111-kiosk`: async API client + Pydantic models
  (`src/client`, `src/models`), the scan-code reader layer
  (`src/scan`: protocol + keyboard-wedge driver for development) and the
  scan-code backend (#143, `GET /api/v1/scan/lookup/:code`).
- Next: the DESIGN.md visual pass (PR C) — screens are deliberately plain
  until then. See issue #125 for the design and #111 for the roadmap.

> Historical note: the 2026-09 pivot retired the planned NFC reader (PN532)
> in favour of a 2D scanner; `src/scan` replaces the old `src/nfc` layer.

## Run

Python >= 3.13 with uv. From this directory:

    uv sync
    cp .env.example .env      # then set KIOSK_API_KEY (see Configuration)
    uv run --env-file .env python main.py

Development opens a 1024x600 window; on the Pi set `KIOSK_FULLSCREEN=1` in
`.env` for a fullscreen run.

Run it from a real console: the keyboard-wedge reader uses `msvcrt`, so an
IDE's embedded console will not feed it typed codes.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `KIOSK_API_URL` | `http://localhost:8080/api/v1` | Backend API base URL |
| `KIOSK_API_KEY` | *(unset)* | Seller-scoped API key, created in the web UI under `/api-keys`; the scan lookup and the sale are both guarded |
| `KIOSK_FULLSCREEN` | *(unset)* | Set to `1` for a fullscreen run on the Pi |

The kiosk reads plain environment variables — `.env.example` is the whole
config surface. `uv run` does not read `.env` on its own, so pass it
explicitly:

    uv run --env-file .env python main.py

`.env` is gitignored (the same rule the backend's root `.env` uses). For a
one-off run you can set variables inline instead:

    $env:KIOSK_API_KEY="<key>"; uv run python main.py   # PowerShell
    set KIOSK_API_KEY=<key> && uv run python main.py    # cmd

On the Pi, set the same variables in the systemd unit rather than shipping
a file (`EnvironmentFile=/etc/beerswipe-kiosk.env`).

Without `KIOSK_API_KEY` the app still boots: the drinks list works (public
route) but every scan lands on the error screen with the backend's
message.

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

    uv run mypy -p src.models -p src.client -p src.scan -p src.flow --strict
    uv run ruff check src/ main.py tests/
    uv run pytest

`src/ui` is not part of the strict mypy run because kivy ships no type
info; `src/flow` is plain Python, so the scan-to-buy logic is both
strictly typed and covered by the headless flow tests.

## Layout

- `main.py`: entry point
- `src/models`: Pydantic mirrors of the shared TS contracts
- `src/client`: async httpx API client (single pooled connection)
- `src/scan`: scan-code reader layer (protocol + keyboard driver)
- `src/flow`: flow controller, state machine and async runner (no kivy)
- `src/ui`: kivy App, ScreenManager and screens
- `tests`: headless flow tests (fake api, executor and scheduler)
