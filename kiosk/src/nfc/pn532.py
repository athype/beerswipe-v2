"""PN532 NFC reader over USB serial (HSU) — real hardware backend.

The PN532 breakout (e.g. Elechouse V3/V4) exposes the chip behind a
USB serial bridge (CH340 or FTDI), so we talk the PN532 HSU protocol
directly through pyserial.  This works identically on Windows (COM
port) and Linux (``/dev/ttyUSB0``), which is why it is preferred over
the GPIO-wired variant (Pi-only).

Protocol summary (NXP PN532 User Manual, section 6):

- wakeup:      ``55 55 00 00 00 00 00 00 00`` at 115200 baud
- command:     ``00 00 FF LEN LCS D4 <cmd...> DCS 00``
- response:    ``00 00 FF LEN LCS D5 <data...> DCS 00``
- after each command the chip sends an ACK (``00 00 FF 00 FF 00``);
  we skip it implicitly by scanning for the response preamble.

A GPIO (I²C/SPI) variant for the wired PN532 can be added later behind
the same ``NfcReader`` interface.
"""

import threading
import time

import serial
from serial.tools import list_ports

from .protocol import NfcReader, OnCardTap

# ---------------------------------------------------------------------------
# Protocol constants
# ---------------------------------------------------------------------------

_BAUDRATE = 115200
_SERIAL_TIMEOUT = 0.05  # per read(1) poll; deadlines bound the real waits

_PREAMBLE = b"\x00\x00\xff"
_TFI_HOST = 0xD4
_TFI_PN532 = 0xD5
_WAKEUP = b"\x55\x55" + b"\x00" * 7

_CMD_GET_FIRMWARE_VERSION = 0x02
_CMD_IN_LIST_PASSIVE_TARGET = 0x4A
# 0x0A * 50 ms = 500 ms antenna polling window per ReadPassiveTarget call.
# Bounded on purpose: a 0x00 (infinite) timeout would leave the chip stuck
# polling and desync every following command.
_POLL_TIMEOUT = 0x0A


class Pn532Error(Exception):
    """Raised when the PN532 hardware misbehaves (no response, bad checksum)."""


def _auto_detect_port() -> str | None:
    """Return the first plausible PN532 serial port, or None.

    Matches common USB bridges: CH340 (Elechouse V3 onboard) and FTDI
    (generic USB-TTL adapters used for the wired variant).
    """
    for port in list_ports.comports():
        if port.vid == 0x1A86 and port.pid == 0x7523:  # CH340
            return port.device
        if port.vid == 0x0403:  # FTDI
            return port.device
        description = port.description or ""
        if "CH340" in description or "USB Serial" in description:
            return port.device
    return None


def _format_uid(uid: bytes) -> str:
    """Hex-colon uppercase UID, e.g. ``04:AB:CD:EF:12:34`` (4 or 7 bytes)."""
    return ":".join(f"{b:02X}" for b in uid)


# ---------------------------------------------------------------------------
# Reader
# ---------------------------------------------------------------------------


class Pn532HsuReader(NfcReader):
    """Reads card UIDs from a PN532 over its USB serial (HSU) interface.

    Args:
        port: serial port to use (``COM3``, ``/dev/ttyUSB0``).  When
            omitted, the first CH340/FTDI port found is used.
        baudrate: HSU speed; the chip defaults to 115200.

    The reader verifies the link with GetFirmwareVersion during
    ``start()`` and raises :class:`Pn532Error` when the hardware does
    not answer.  Tap semantics: the callback fires when a card appears
    on the antenna and stays quiet while it is held; removing and
    re-tapping fires again.
    """

    def __init__(self, port: str | None = None, baudrate: int = _BAUDRATE) -> None:
        self._port = port or _auto_detect_port()
        self._baudrate = baudrate
        self._ser: serial.Serial | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._current_uid: str | None = None
        self._firmware: str | None = None

    # ------------------------------------------------------------------
    # Lifecycle (NfcReader)
    # ------------------------------------------------------------------

    def start(self, *, on_card: OnCardTap) -> None:
        if self._thread is not None:
            raise RuntimeError("NFC reader is already running")

        self._open()
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._poll_loop,
            args=(on_card,),
            daemon=True,
            name="pn532-hsu",
        )
        self._thread.start()

    def stop(self) -> None:
        if self._thread is None:
            return
        self._stop_event.set()
        self._thread.join(timeout=2)
        self._thread = None
        self._close()

    @property
    def firmware_version(self) -> str | None:
        """Chip firmware string (e.g. ``A7.05``), set by ``start()``."""
        return self._firmware

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def _open(self) -> None:
        if self._port is None:
            raise Pn532Error(
                "no serial port found for the PN532 — pass port= explicitly",
            )

        ser = serial.Serial(
            self._port, self._baudrate, timeout=_SERIAL_TIMEOUT,
        )
        try:
            # Wake the chip out of HSU standby, then drop any noise it emitted.
            ser.write(_WAKEUP)
            ser.flush()
            time.sleep(0.1)
            ser.reset_input_buffer()

            version = self._get_firmware_version(ser)
        except serial.SerialException as exc:
            ser.close()
            raise Pn532Error(f"cannot open {self._port}: {exc}") from exc

        if version is None:
            ser.close()
            raise Pn532Error(
                f"no firmware response from PN532 on {self._port} — "
                "check the USB cable, CH340/FTDI driver, and that nothing "
                "else holds the port",
            )

        self._ser = ser
        self._firmware = version

    def _close(self) -> None:
        if self._ser is not None:
            self._ser.close()
            self._ser = None

    # ------------------------------------------------------------------
    # Poll loop
    # ------------------------------------------------------------------

    def _poll_loop(self, on_card: OnCardTap) -> None:
        assert self._ser is not None
        while not self._stop_event.is_set():
            try:
                uid = self._poll_once(self._ser)
            except Pn532Error:
                # Transient comm hiccup: retry without touching tap state,
                # so a held card does not re-trigger after a bad read.
                time.sleep(0.2)
                continue
            self._handle_poll(on_card, uid)

    def _handle_poll(self, on_card: OnCardTap, uid: str | None) -> None:
        """Tap state machine: fire only on the appearance of a UID."""
        if uid is None:
            self._current_uid = None
        elif uid != self._current_uid:
            self._current_uid = uid
            on_card(uid)

    def _poll_once(self, ser: serial.Serial) -> str | None:
        """One ReadPassiveTarget round trip; ``None`` = no card present."""
        self._write_command(
            ser,
            bytes([_CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00, _POLL_TIMEOUT]),
        )
        payload = self._read_response(ser)
        if payload is None:
            raise Pn532Error("no response frame from PN532")
        if len(payload) < 3 or payload[0] != _TFI_PN532 or payload[1] != 0x4B:
            raise Pn532Error(f"unexpected response: {payload.hex()}")

        nb_tg = payload[2]
        if nb_tg == 0:
            return None
        uid_len = payload[4]
        uid = payload[5 : 5 + uid_len]
        return _format_uid(uid)

    def _get_firmware_version(self, ser: serial.Serial) -> str | None:
        """Probe the chip; retries once (first command after wakeup can be eaten)."""
        for _ in range(2):
            self._write_command(ser, bytes([_CMD_GET_FIRMWARE_VERSION]))
            try:
                payload = self._read_response(ser)
            except Pn532Error:
                payload = None
            if (
                payload is not None
                and len(payload) >= 5
                and payload[0] == _TFI_PN532
                and payload[1] == 0x03
            ):
                return f"{payload[3]:02X}.{payload[4]:02X}"
        return None

    # ------------------------------------------------------------------
    # HSU framing
    # ------------------------------------------------------------------

    @staticmethod
    def _write_command(ser: serial.Serial, cmd: bytes) -> None:
        """Send one HSU command frame (host → PN532)."""
        data = bytes([_TFI_HOST]) + cmd
        length = len(data)
        frame = (
            _PREAMBLE
            + bytes([length, (-length) & 0xFF])
            + data
            + bytes([(-sum(data)) & 0xFF, 0x00])
        )
        ser.write(frame)
        ser.flush()

    def _read_response(self, ser: serial.Serial, timeout: float = 1.2) -> bytes | None:
        """Read one response frame payload; ``None`` on deadline.

        The ACK frame (``00 00 FF 00 FF 00``) carries the same preamble
        as a data frame — it is a zero-length frame, so it is consumed
        and the scan continues to the real response.  This makes ACK
        handling tolerant of firmware quirks (chip may or may not ACK).
        """
        deadline = time.monotonic() + timeout

        while True:
            # Scan for the frame preamble, skipping any stray bytes.
            window = bytearray()
            while time.monotonic() < deadline:
                chunk = ser.read(1)
                if not chunk:
                    continue
                window.append(chunk[0])
                if len(window) > 3:
                    del window[0]
                if window == _PREAMBLE:
                    break
            else:
                return None  # no frame within the deadline

            head = self._read_until(ser, 2, deadline)
            if head is None:
                return None
            length, lcs = head
            if length == 0:
                # ACK frame (00 00 FF 00 FF 00) — fixed special frame that
                # violates the normal LCS rule; consume it, keep scanning.
                self._read_until(ser, 1, deadline)
                continue
            if (length + lcs) & 0xFF != 0:
                raise Pn532Error("bad frame header checksum")

            payload = self._read_until(ser, length, deadline)
            if payload is None:
                return None
            dcs = self._read_until(ser, 1, deadline)
            postamble = self._read_until(ser, 1, deadline)
            if dcs is None or postamble is None:
                return None
            if (sum(payload) + dcs[0]) & 0xFF != 0:
                raise Pn532Error("bad frame payload checksum")
            if postamble != b"\x00":
                raise Pn532Error("bad frame postamble")

            return bytes(payload)

    @staticmethod
    def _read_until(ser: serial.Serial, n: int, deadline: float) -> bytes | None:
        """Read exactly *n* bytes or return ``None`` at *deadline*."""
        out = bytearray()
        while len(out) < n and time.monotonic() < deadline:
            chunk = ser.read(n - len(out))
            if not chunk:
                continue
            out.extend(chunk)
        return bytes(out) if len(out) == n else None
