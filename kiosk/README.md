# Beerswipe Kiosk

Kivy touch kiosk for the Beerswipe bar. Targets a Raspberry Pi with a 7"
1024x600 touch panel; developed on Windows.

## Status

- Working scan-to-buy flow: scan a code, build a basket of drinks, confirm,
  and the whole order is posted as one atomic sale — the result screen shows
  the member's remaining credits and every screen times back to idle. The
  state machine, timeouts and error handling live in `src/flow`, which is
  kivy-free so the flow is covered headless by `tests/test_flow.py`.
- Basket picking: **tap a drink to add one** (tap again to add more — the row
  shows a `×N` badge). The bottom stepper edits the **last-tapped** line:
  `-` at one removes that line (focus moves to a neighbouring line), `+` is
  capped at the drink's stock. `Continue` opens the itemised summary; `Back`
  returns to the basket with it intact. Re-scanning or idling for 60 s clears
  everything.
- Multi-drink orders post `POST /api/v1/sales/sell` once with `items[]`; the
  backend charges credits and every drink's stock in one transaction and undo
  reverses the whole order (see the root README and `AGENTS.md`).
- Merged on `feature/BS-111-kiosk`: async API client + Pydantic models
  (`src/client`, `src/models`), the scan-code reader layer
  (`src/scan`: protocol + keyboard-wedge driver for development) and the
  scan-code backend (#143, `GET /api/v1/scan/lookup/:code`).
- Visual pass (PR C): the screens follow `frontend/DESIGN.md`, the "Beer
  Machine" system — see [Design](#design) below. See issue #125 for the
  design and #111 for the roadmap.

> Historical note: the 2026-09 pivot retired the planned NFC reader (PN532)
> in favour of a 2D scanner; `src/scan` replaces the old `src/nfc` layer.

## Run

Python >= 3.13 with uv. From this directory:

    uv sync
    cp .env.example .env      # then set KIOSK_API_KEY (see Configuration)
    uv run --env-file .env python main.py

Development opens a 1024x600 window; on the Pi set `KIOSK_FULLSCREEN=1` in
`.env` for a fullscreen run.

Run it from a real console: the default keyboard reader uses `msvcrt`, so an
IDE's embedded console will not feed it typed codes. Typing into the window
(`KIOSK_SCAN_READER=window`) works anywhere.

## Design

The look mirrors `frontend/DESIGN.md` (the "Beer Machine" dark-glass
system) onto Kivy:

- `src/ui/theme.py` — palette, radius/spacing scales, the Inter type scale,
  the bundled fonts and the two runtime textures.
- `src/ui/widgets.py` — the shared vocabulary: the drifting backdrop, the
  glass panel, primary/secondary buttons, the mint money label, the drink
  row and the card divider.

Kivy has no CSS and no backdrop blur, so glass is a translucent fill plus a
1px bottle-green border with a shadow underlay, and the "alive" background
is three tinted glow orbs drifting under a tiled noise texture — both are
generated at runtime, so there are no image assets to ship. Inter is not a
webfont in the web app and the Pi's Linux fallback would look off, so the
four static weights are bundled in `assets/fonts/` (Inter 4.1, SIL Open
Font License 1.1 — the license text is `assets/fonts/OFL.txt`).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `KIOSK_API_URL` | `http://localhost:8080/api/v1` | Backend API base URL |
| `KIOSK_API_KEY` | *(unset)* | Seller-scoped API key, created in the web UI under `/api-keys`; the scan lookup and the sale are both guarded |
| `KIOSK_FULLSCREEN` | *(unset)* | Set to `1` for a fullscreen run on the Pi |
| `KIOSK_SCAN_READER` | `keyboard` | Where scans come from: `keyboard` reads typed codes from stdin (development), `window` takes the HID scanner's keystrokes from the Kivy window (the Pi — see [Scanner hardware](#scanner-hardware)) |

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

Honeywell Xenon XP 1950g, configured as a **HID keyboard wedge** with "Add
CR Suffix" scanned on the unit, so every scan arrives as the 32-character
code followed by Enter. HID is the interface for both development and the
Pi — decided 2026-10-06; the "USB serial" alternative is dropped, so there
is no `pyserial` dependency and no serial reader.

The Pi **must** run the kiosk with `KIOSK_SCAN_READER=window`, which takes the
scanner's keystrokes from the Kivy window (`src/scan/window.py`): behind a
fullscreen window they never reach stdin, which is all the keyboard reader
sees anyway (under systemd stdin is `/dev/null`). The window reader consumes
every key a scan produces, so the Enter that ends a scan cannot activate the
button that was tapped just before it. A typo in the setting is a startup
error rather than a silent fallback to the reader that sees nothing.

`KIOSK_SCAN_READER=keyboard` (the default) reads typed codes from stdin
instead, and is the **desktop-only** path — for developing on a machine with
no unit attached. With the window reader you can also simply type into the
kiosk window: the reader captures those keystrokes (characters plus Enter) as
a scan, since the kiosk has no text-input widgets.

Windows note, and only relevant if the unit is ever deliberately switched to
serial: install the Honeywell serial driver *before* scanning any "USB
Serial" or other configuration barcode — configuring the scanner for serial
without the driver in place can leave it unable to scan configuration
barcodes. The HID path needs no driver.

## Quality gates

    uv run mypy -p src.models -p src.client -p src.scan -p src.flow --strict
    uv run mypy -p src.ui
    uv run ruff check src/ main.py tests/
    uv run python -m compileall -q src/ui
    uv run pytest

`src/ui` is not part of the strict mypy run because kivy ships no type
info, so it is checked non-strict and byte-compiled instead — it cannot be
imported without a display, which is why the visual check is a manual run.
`src/flow` is plain Python, so the scan-to-buy logic is both strictly
typed and covered by the headless flow tests.

## Layout

- `main.py`: entry point
- `src/models`: Pydantic mirrors of the shared TS contracts
- `src/client`: async httpx API client (single pooled connection)
- `src/scan`: scan-code reader layer (protocol + keyboard and window drivers)
- `src/flow`: flow controller, state machine and async runner (no kivy)
- `src/ui`: kivy App, ScreenManager, screens, design tokens and widgets
- `assets/fonts`: bundled Inter weights (SIL OFL 1.1)
- `tests`: headless flow and scan reader tests (fake api, executor and scheduler)
