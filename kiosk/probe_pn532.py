"""Quick hardware probe for the PN532 USB reader.

Usage (from the ``kiosk/`` directory)::

    uv run python probe_pn532.py            # auto-detect the port
    uv run python probe_pn532.py COM7       # explicit port

Prints the chip firmware version, then every card tap until you press
Enter.  A clean run means the reader, driver, and HSU wiring all work.
"""

import sys

from src.nfc import Pn532Error, Pn532HsuReader


def main() -> int:
    port = sys.argv[1] if len(sys.argv) > 1 else None
    reader = Pn532HsuReader(port=port)

    try:
        reader.start(on_card=lambda uid: print(f"TAP: {uid}"))
    except Pn532Error as exc:
        print(f"Failed to talk to the PN532: {exc}")
        return 1

    print(f"Firmware: {reader.firmware_version}")
    print("Reader active. Tap a card to see its UID. Press Enter to quit.")
    try:
        input()
    finally:
        reader.stop()
    print("Stopped cleanly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
