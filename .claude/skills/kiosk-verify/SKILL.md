---
name: kiosk-verify
description: Use when changing the beerswipe kiosk (kiosk/, Python 3.13 + Kivy + Pydantic + httpx) or when about to claim a kiosk change works. Gives the exact CI commands, the stricter local checks, and the headless verification limits so you do not claim a windowed run that never happened.
---

# Verify the Beerswipe kiosk

## Stack and layout

- Python >= 3.13, managed with `uv`.
- Kivy UI, Pydantic API models, httpx async client.
- Flat `src/` packages: `src/models/`, `src/client/`, `src/scan/`, `src/flow/`, `src/ui/`.
- `src/flow/` is plain Python with no Kivy import. The state machine and scan-to-buy logic live there and are covered headlessly by `tests/`.
- `src/ui/` is thin Kivy renderers that emit intents into the flow.
- `frontend/DESIGN.md` is the visual source of truth. `src/ui/theme.py` and `src/ui/widgets.py` mirror it.

## CI commands (authoritative)

These are the exact commands in `.github/workflows/ci.yml`. Run them from `kiosk/`:

```bash
uv sync --frozen
uv run pytest
uv run mypy -p src.models -p src.client -p src.scan --strict
uv run mypy -p src.ui
uv run ruff check src/ main.py
```

If a change passes these, it passes the kiosk CI job. Do not substitute `uv run mypy src/`; relative imports fail because `src` is resolved as a namespace package from the kiosk root. Always use `-p` module paths.

`src/ui` is not part of the strict run because Kivy ships no type information. The `pyproject.toml` override for `kivy.*` is required for mypy 2.x; do not remove it.

## Stricter local set (README, not CI)

`kiosk/README.md` also lists these. Run them when touching the relevant area, but do not describe them as CI gates:

```bash
uv run mypy -p src.flow --strict
uv run ruff check src/ main.py tests/
uv run python -m compileall -q src/ui
```

`src/flow` is plain Python and can pass strict mypy. `tests/` is linted locally but CI only lints `src/` and `main.py`. Byte-compiling `src/ui` catches syntax errors without importing Kivy.

## Headless verification limit

`src.ui` imports Kivy, and Kivy resolves the Window provider at import time. In a headless sandbox that fails with "Unable to get a Window", even for modules as small as `kivy.uix.label`. `KIVY_GL_BACKEND=mock` plus `SDL_VIDEODRIVER=dummy` does not fix it, because SDL's dummy driver has no GL.

Consequences:

- Never import or instantiate `src.ui` in a headless check and call it verified.
- Verify UI code with mypy, ruff and `compileall` only.
- Ask the user to run the window on Windows or the Pi:

```bash
cd kiosk
uv run --env-file .env python main.py
```

- Never claim a windowed run happened from a headless environment.

## Runtime and configuration

`uv run` does not read `.env` on its own:

```bash
uv run --env-file .env python main.py
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `KIOSK_API_URL` | `http://localhost:8080/api/v1` | Backend API base URL |
| `KIOSK_API_KEY` | unset | Seller-scoped API key from `/api-keys`; without it the drinks list loads but scans fail |
| `KIOSK_FULLSCREEN` | unset | `1` on the Pi |
| `KIOSK_SCAN_READER` | `keyboard` | `keyboard` for desktop stdin, `window` for the Pi |

- The Pi must run `KIOSK_SCAN_READER=window`. Under systemd stdin is `/dev/null`, and a fullscreen Kivy window consumes the scanner keystrokes before stdin sees them.
- The scanner is a Honeywell Xenon XP 1950g configured as an HID keyboard wedge with a CR suffix. There is no serial dependency and no `pyserial`.
- `KIOSK_SCAN_READER=keyboard` uses `msvcrt`, so an IDE embedded console will not feed it typed codes. Use `window` to type into the kiosk window anywhere.

## API contract rules

- Pydantic models in `src/models/` mirror the shared contracts in `types/src/`. When an API shape changes, update both sides in the same change.
- Keep one pooled `httpx.AsyncClient` per client instance. Never create a client per request.
- Provide and use `aclose()` and the async context manager.
- Auth is `X-API-Key` (seller scope) or Bearer JWT.
- A sale posts once with `items[]`. The backend charges credits and every drink's stock in one transaction, and undo reverses the whole sale group. Do not implement per-item charging in the kiosk.

## Pitfalls

- `uv run mypy src/` fails on relative imports. Use `-p src.models -p src.client -p src.scan`.
- Removing the `kivy.*` mypy override breaks every Kivy import under mypy 2.x.
- Importing `src.ui` for a quick test fails without a display. Do not add UI imports to headless tests.
- Unit tests use fake API, executor and scheduler objects. Do not point them at a live backend.
- Do not add systemd units to the repo. The Pi deploy is manual and lives on the device.
- If `frontend/DESIGN.md` changes, the Kivy theme does not update itself. Check whether `src/ui/theme.py` and `src/ui/widgets.py` need the same change.

## Before saying a kiosk change is done

1. `uv run pytest`
2. `uv run mypy -p src.models -p src.client -p src.scan --strict`
3. `uv run mypy -p src.ui`
4. `uv run ruff check src/ main.py`
5. If `src/flow` changed, add `uv run mypy -p src.flow --strict` and a test in `tests/`.
6. If UI changed, `uv run python -m compileall -q src/ui` and ask the user for a windowed run. Report it as "needs a visual check", not "verified".
7. If an API contract changed, confirm `types/src/` and the backend were updated too.
