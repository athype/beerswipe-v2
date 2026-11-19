# Kiosk Scan Input Hardening - Design Spec

GitHub issue: [#192](https://github.com/athype/beerswipe-v2/issues/192) · Branch: `bs-111/hermes-scan-input-hardening-spec` (spec; implementation branch TBD) · Date: 2026-11-19

## 1. Problem

The kiosk's HID scanner types whatever a QR code contains into the Kivy window. The reader treats every CR/LF as the end of a scan, and the flow accepts any string as a member code. One QR with 80 lines therefore produces 80 scans, 80 flow restarts, 80 `/scan/lookup` submissions and 80 screen rebuilds. Measured against the real reader and the flow test harness:

- 80-line payload (2,480 chars): 80 `on_scan` calls.
- Same 80 fragments through `FlowController`: 80 executor submissions and 80 view pushes.
- 2,900-char payload: 1 scan, but the `deque(maxlen=64)` keeps only the last 64 chars and sends that tail as the lookup code.
- The reader's buffer logic itself costs under 1 ms for 2,900 chars, so the parser is not the cost. The UI churn and the wasted HTTP requests are.

The backend rejects anything that is not 32 hex before touching the DB (`scanCodeParamSchema` in `backend/src/validation/contracts.ts`), so the server is not the bottleneck. The kiosk pays for the transition and the round trip first.

## 2. Goals and non-goals

Goals:

- One physical scan produces at most one `on_scan` callback.
- Payloads that cannot be a member code never enter the flow and never call the API.
- An active flow (user resolved, basket filled) is not disturbed by a junk scan.
- The valid 32-hex path keeps working, including uppercase scans.
- The reader stays headless-testable with a fake clock and scheduler.
- The design leaves room for #191 product barcodes without rewriting the reader.

Non-goals:

- Product barcode lookup and basket filling (#191).
- Backend rate limiting (#133).
- New invalid-scan UI or telemetry (#138). Junk scans are silent by design.
- Scanner firmware changes. README configuration notes only.

## 3. Current behavior

Reader (`kiosk/src/scan/window.py`):

- `_feed()` flushes on every `\r` or `\n`.
- `_on_key_down()` flushes on Enter (keycodes 13 and 271).
- `_buffer` is `deque(maxlen=64)`; overflow logs once and drops the oldest input.
- `IDLE_RESET_SECONDS = 1.0` clears stale input only when the next character arrives.

Controller (`kiosk/src/flow/controller.py`):

- `scan()` returns only for `SELLING`; every other state accepts any string, clears the current user and basket, bumps the token, enters `RESOLVING` and submits `_resolve_scan(code)`.
- `_resolve_scan()` does `lookup_scan_code(code)` then `list_active()`.

UI (`kiosk/src/ui/screens.py`, `kiosk/src/ui/app.py`):

- `GreetingScreen.render()` does `clear_widgets()` and rebuilds its panel on every publish.
- `RootScreenManager.render()` switches `current` when the state changes; the manager uses a 0.15 s `FadeTransition`, restarted on each switch.

Client (`kiosk/src/client/users.py`):

- Builds `/scan/lookup/{code}` with an f-string; the code is not URL-encoded.

## 4. Design overview

Three layers, in order:

```
HID keystrokes
  -> WindowScanReader frame buffer (terminator: 200 ms quiet)
     -> is_scannable_payload?  no -> drop, debug log
        yes -> on_scan
  -> FlowController.scan
     -> classify_scan == USER? no -> drop, no state change
        yes -> cooldown / duplicate check -> RESOLVING -> API
  -> UsersClient.lookup_scan_code: URL-encode the path segment
```

1. Reader syntax gate: ASCII alphanumeric, 1 to 48 characters, one frame per physical scan. This drops URLs, symbol-heavy payloads and dense payloads before they reach the flow.
2. Controller policy gate: only a 32-hex user code starts the flow today. This also protects the stdin `KeyboardScanReader` dev path and any future reader that bypasses the syntax gate.
3. Burst guard: a 500 ms minimum interval between accepted scans and a 3 s duplicate window. This covers presentation-mode re-reads and people spamming the scanner.

The backend stays unchanged.

## 5. `kiosk/src/scan/codes.py` (new)

Single home for scan formats. Both the reader and the flow import from here.

```python
"""Scan-code formats shared by the kiosk readers and the flow."""

import re
from enum import Enum

#: A member code is exactly 32 lowercase hex characters.
USER_CODE_LENGTH = 32

#: Upper bound for a plausible scan payload. Fits a user code with headroom
#: and the product barcodes planned in #191 (EAN/UPC/Code128, <= 48 chars).
MAX_SCAN_LENGTH = 48

_USER_CODE_RE = re.compile(r"[0-9a-f]{32}")


class ScanKind(Enum):
    """What a scanned payload is, as far as the kiosk can tell."""

    USER = "user"
    INVALID = "invalid"


def normalize_scan_code(code: str) -> str:
    """Strip surrounding whitespace and lowercase for comparison."""
    return code.strip().lower()


def is_scannable_payload(text: str) -> bool:
    """Could *text* be a scan code or barcode at all?

    ASCII alphanumeric only, 1..MAX_SCAN_LENGTH characters. This is the
    reader's syntax gate: it rejects URLs, punctuation, whitespace inside
    the payload, non-ASCII text and oversized payloads.
    """
    return (
        0 < len(text) <= MAX_SCAN_LENGTH
        and text.isascii()
        and text.isalnum()
    )


def classify_scan(code: str) -> ScanKind:
    """Classify a payload for the flow.

    USER for a 32-hex member code; INVALID for everything else. #191 adds
    PRODUCT (alphanumeric barcode) here and in the controller.
    """
    normalized = normalize_scan_code(code)
    return ScanKind.USER if _USER_CODE_RE.fullmatch(normalized) else ScanKind.INVALID
```

Exports in `kiosk/src/scan/__init__.py`: add `MAX_SCAN_LENGTH`, `USER_CODE_LENGTH`, `ScanKind`, `classify_scan`, `is_scannable_payload`, `normalize_scan_code` to the imports and `__all__`. Keep the existing reader exports.

Why `MAX_SCAN_LENGTH = 48`: #191's design says product barcodes are free-form alphanumeric up to 48 chars. Using the same bound now means the reader will not need a second rewrite for product scanning.

Why no `PRODUCT` value yet: adding an enum member that is never returned is dead code. #191 adds it together with the product lookup path. The reader does not depend on `ScanKind`, only on `is_scannable_payload`, so it is already product-ready.

## 6. Reader changes (`kiosk/src/scan/window.py`)

### 6.1 Frame by quiet period, not by Enter

A QR payload can contain CR/LF. The HID wedge sends those as Enter keystrokes, so an embedded newline is indistinguishable from the scanner's suffix Enter at the moment it arrives. The only reliable boundary is when the scanner stops typing.

New constants:

```python
FRAME_QUIET_SECONDS = 0.20
MAX_FRAME_SECONDS = 2.0
```

The reader:

- appends every printable character to a frame buffer;
- resets a 200 ms quiet timer on every character;
- appends CR/LF to the buffer instead of flushing;
- on quiet, commits the frame: strip trailing CR/LF, validate, deliver or drop;
- if a frame stays open longer than 2 s (continuous input), commits and drops it, then starts a new frame. This bounds a stuck or malicious stream.

200 ms is chosen because the scanner types continuously and the next user-visible cost is the 150 ms fade plus the API round trip. Going below 100 ms risks splitting a dense payload on USB scheduling jitter; going above 300 ms starts to feel laggy after a scan.

### 6.2 Commit rules

At commit:

1. `raw = "".join(buffer)`.
2. `payload = raw.rstrip("\r\n").strip()`.
3. Drop if `_overflowed`, if `"\r"` or `"\n"` remains inside `payload` (a multi-line payload), or if `not is_scannable_payload(payload)`.
4. Otherwise call `on_scan(payload)`.

Notes:

- A normal 32-hex code plus the suffix CR becomes `payload == code`, delivered once.
- An 80-line payload still contains embedded newlines after the trailing strip, so it is dropped once. No `on_scan` call.
- A URL fails `is_scannable_payload` because of `:`, `/`, `.`, `?`, etc.
- A 2,900-char payload sets `_overflowed` and is dropped; no tail is sent.
- The code is passed through as typed. The backend lowercases the lookup param, so casing is not a problem. The existing test that expects the reader to lowercase needs to move to the controller or be updated (see §10).

### 6.3 Buffer cap

Replace `deque(maxlen=BUFFER_LIMIT)` with a list and an `_overflowed` flag. Append while `len(buffer) < MAX_SCAN_LENGTH`; on the next character set `_overflowed = True` and stop appending. Continue resetting the quiet timer so the whole physical scan is consumed as one frame, then drop it.

`BUFFER_LIMIT` and the "buffer full" warning go away. The new debug log is one record per dropped frame:

```python
logger.debug(
    "Dropped scan frame: %d chars, reason=%s",
    len(raw),
    reason,  # "overflow" | "multiline" | "charset" | "empty"
)
```

Do not log the payload. It can contain a member code or arbitrary user data.

### 6.4 Scheduler seam

`WindowScanReader.__init__(*, clock=time.monotonic, scheduler: Scheduler | None = None)`.

- `Scheduler` has the same shape as the flow controller's: `schedule(delay, callback) -> TimerHandle` with `cancel()`. Define it locally in `window.py` so the scan package does not depend on the flow package.
- `start()` creates a Kivy-backed scheduler if none was injected:

```python
from kivy.clock import Clock

self._scheduler = self._scheduler or _ClockScheduler(Clock)
```

with

```python
class _ClockScheduler:
    def schedule(self, delay, callback):
        return Clock.schedule_once(lambda _dt: callback(), delay)
```

- `_schedule_commit()` cancels the previous handle and schedules `_commit_frame` after `FRAME_QUIET_SECONDS`.
- `stop()` cancels the pending handle and clears the frame before unbinding the window.
- Tests inject a `FakeScheduler` and drive it by hand; production keeps the "callback on the Kivy thread" guarantee.

### 6.5 Window handlers

`_on_textinput(window, text)` feeds every character, including CR/LF.

`_on_key_down`:

- Enter (13, 271): `self._feed("\r")`, return `True`.
- Printable codepoint: return `True` (consume; the character arrives through `on_textinput`).
- Everything else: return `False`.

Enter is fed rather than flushed. If both text input and key-down deliver the CR, the buffer ends with two CRs; `rstrip("\r\n")` removes both. If only key-down delivers it, the frame still ends correctly.

Non-printable characters inside `on_textinput` (other than CR/LF) mark the frame invalid. They are not appended.

### 6.6 Protocol docstring

Update `kiosk/src/scan/protocol.py`: `on_scan` receives a plausible scan payload (ASCII alphanumeric, <= 48 chars), not necessarily a 32-char user code. No signature change. `KeyboardScanReader` is unchanged; the controller gate covers it.

The threading note should distinguish the readers: `KeyboardScanReader` calls from its own thread; `WindowScanReader` calls on the Kivy thread through its scheduler. The app's `Clock.schedule_once` hop is harmless for both.

## 7. Controller changes (`kiosk/src/flow/controller.py`)

### 7.1 Clock seam

Add `clock: Callable[[], float] = time.monotonic` to `__init__`, stored as `self._clock`. Production does not pass it; tests inject a fake.

### 7.2 Constants

```python
MIN_SCAN_INTERVAL_SECONDS = 0.5
DUPLICATE_SCAN_WINDOW_SECONDS = 3.0
```

### 7.3 `scan()` order

```python
def scan(self, code: str) -> None:
    if self._state is FlowState.SELLING:
        return

    kind = classify_scan(code)
    if kind is not ScanKind.USER:
        # Junk must not touch the flow: no transition, no API, no basket reset.
        return

    normalized = normalize_scan_code(code)
    now = self._clock()
    if self._last_accepted_at is not None:
        if now - self._last_accepted_at < MIN_SCAN_INTERVAL_SECONDS:
            return
        if (
            normalized == self._last_accepted_code
            and now - self._last_accepted_at < DUPLICATE_SCAN_WINDOW_SECONDS
        ):
            return

    self._last_accepted_at = now
    self._last_accepted_code = normalized

    # ... existing reset + RESOLVING + submit(normalized)
```

Behavior:

- Invalid code in any state: return before clearing `_user`, `_drinks`, the basket or the error. An active `SELECTING` session survives a junk scan.
- Valid different code: accepted after 500 ms, restarts the flow as today ("next customer").
- Same valid code: ignored for 3 s, then accepted again.
- `SELLING`: unchanged, scans are ignored.
- A duplicate that is ignored does not update `_last_accepted_at`, so the window is measured from the last accepted scan.

### 7.4 Reset semantics

`reset()` clears `_last_accepted_at` and `_last_accepted_code` along with the rest of the flow state. A timeout or explicit reset is a new session, so the same code can start it immediately.

## 8. Client change (`kiosk/src/client/users.py`)

URL-encode the path segment:

```python
from urllib.parse import quote

return await self._client.get_model(
    f"/scan/lookup/{quote(code, safe='')}",
    ScanCodeLookupResponse,
)
```

This keeps a stray `/`, `?`, `#`, `%` or space from changing the request shape. The controller gate means this should never trigger in practice; it is defense in depth.

## 9. README and scanner configuration (`kiosk/README.md`)

Add to the scanner hardware or configuration section:

- Enable CodeGate on the Xenon. It suppresses a re-read while the same symbol stays in the field of view.
- Keep Presentation / Streaming Presentation off unless a stand makes hands-free scanning necessary. If it is on, the 3 s duplicate window absorbs the re-reads, but the scanner will still type them.
- Until #191 ships, disable non-QR symbologies (EAN/UPC, Code128) if only member QR codes are in use. This reduces junk from product packaging. It does not stop random QR codes; the software gate does.
- Document the behavior: payloads that are not ASCII alphanumeric or are longer than 48 characters are ignored; a multi-line QR produces no scan. A 32-hex code that is not in the database still reaches the API and shows the normal error screen.

## 10. Tests

### 10.1 `kiosk/tests/test_codes.py` (new)

| case | expected |
|---|---|
| 32 hex, lowercase / uppercase / mixed | `USER` |
| 31 or 33 hex | `INVALID` |
| 32 chars with `g` | `INVALID` |
| `""`, `"   "` | `INVALID` |
| URL | `INVALID` |
| `"snake!"` | `INVALID` |
| 48 alphanumerics | `is_scannable_payload` true, `classify_scan` `INVALID` (today) |
| 49 alphanumerics | `is_scannable_payload` false |
| non-ASCII letters | `is_scannable_payload` false |
| leading/trailing whitespace around a code | `USER` after normalization |

### 10.2 `kiosk/tests/test_window_reader.py` (rewrite framing tests)

Add a `FakeScheduler` alongside `FakeClock`, and pass both into `WindowScanReader`. Existing immediate-flush tests change to "feed, advance the scheduler by `FRAME_QUIET_SECONDS`, assert one callback":

- valid code with Enter / keypad Enter / CR in text input -> one callback.
- empty Enter -> no callback.
- 80-line payload -> no callback, one debug drop, buffer cleared.
- 500-char URL -> no callback, no truncated tail.
- 49 alphanumeric chars -> no callback.
- 48 alphanumeric chars -> one callback (the controller rejects it today; the reader is product-ready).
- non-ASCII payload -> no callback.
- chunks less than 200 ms apart -> one frame.
- two valid codes more than 200 ms apart -> two callbacks (the reader emits both; the flow cooldown may drop the second).
- continuous input longer than `MAX_FRAME_SECONDS` -> frame dropped, a new frame starts.
- `stop()` cancels the pending timer and clears; restart works.
- start/stop binding tests stay as they are.

Delete or rewrite the tests that encode the old semantics: `test_enter_flushes_a_normalized_code`, `test_keypad_enter_flushes_too`, `test_cr_from_textinput_flushes`, `test_flush_clears_the_buffer`, `test_buffer_is_capped`, `test_buffer_overflow_logs_once`, `test_stale_input_is_dropped`. They describe the bug.

### 10.3 `kiosk/tests/test_flow.py` (add)

Add a `FakeClock` and pass it into `FlowController` through `make_harness`.

- URL / `"hello"` / 31-hex / 33-hex -> state stays `IDLE`, executor pending 0, no view pushes.
- Invalid scan during `SELECTING` -> state stays `SELECTING`, basket and user intact.
- Uppercase 32-hex -> accepted, submission carries the normalized code.
- Two different codes 100 ms apart -> one submission.
- Two different codes 600 ms apart -> two submissions.
- Same code at 0 s and 1 s -> one submission; at 4 s -> two.
- Scan during `SELLING` -> ignored (existing test stays).

## 11. Verification

```bash
cd kiosk
uv run pytest
uv run mypy -p src.models -p src.client -p src.scan --strict
uv run mypy -p src.ui
uv run ruff check src/ main.py
```

Local extras from `kiosk/README.md` (not CI): `uv run mypy -p src.flow --strict`, `uv run ruff check src/ main.py tests/`, `uv run python -m compileall src/ui`.

Manual, on Windows and the Pi:

- Scan a valid code: resolves and sells as before.
- Scan an 80-line QR: no screen change, no `/scan/lookup` in the backend log.
- Scan a URL QR: no screen change.
- Scan the same valid code twice within 3 s: one flow.
- Scan two different valid codes 100 ms apart: one flow; 600 ms apart: two.
- Scan a dense QR repeatedly: the kiosk stays responsive; no error-screen strobe.
- Check the kiosk log: one debug line per dropped frame, no payload content.

## 12. Risks and trade-offs

- 200 ms added latency per scan. This is below the 150 ms fade plus the API round trip, so the screen does not feel slower in practice. If it does, 150 ms is the floor; below 100 ms risks splitting payloads on USB jitter.
- A valid code followed by stray characters inside the same 200 ms window becomes one invalid frame and is dropped. The user scans again. Delivering a corrupted code is worse.
- A scanner configured with a very slow inter-character delay could split frames. The Xenon's HID default is much faster. If it happens, raise `FRAME_QUIET_SECONDS` to 0.3.
- Presentation mode can still re-read every few seconds. The 3 s duplicate window suppresses the common case; CodeGate is the hardware fix.
- The reader still processes every keystroke on the Kivy thread. The parser is cheap (under 1 ms for 2,900 chars), and junk no longer causes UI rebuilds or HTTP requests. Kivy event dispatch for a dense QR is the remaining unavoidable cost.
- #191: the reader's 48-char alphanumeric gate and quiet framing are product-ready. The controller's classifier adds `PRODUCT` and the flow adds product handling. Case preservation for case-sensitive Code128 must be revisited in #191; this spec normalizes user codes only and passes the payload as typed.

## 13. Out of scope

- Backend rate limiting (#133).
- Product barcode lookup (#191).
- Telemetry and invalid-scan counts (#138).
- PIN fallback (#114).
- Scanner firmware or a new reader.

## 14. Implementation order

1. `codes.py` and `test_codes.py`.
2. Reader framing, scheduler seam and `test_window_reader.py`.
3. Controller gate, cooldown, clock seam and `test_flow.py`.
4. Client `quote` and README notes.
5. Run the gates; manual scan tests on Windows and the Pi.

One PR. No backend changes. The spec branch is docs-only; the implementation can branch from master after the spec merges.
